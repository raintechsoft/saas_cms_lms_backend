import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const DEFAULT_TYPES: Array<{
  name: string;
  code: string;
  description: string;
  isPaid: boolean;
  applicableTo: string;
  annualLimit: number;
  defaultAllocationDays: number;
  genderApplicability?: string;
}> = [
  {
    name: "Casual Leave",
    code: "CL",
    description: "Paid leave granted for short personal needs.",
    isPaid: true,
    applicableTo: "ALL",
    annualLimit: 12,
    defaultAllocationDays: 12,
  },
  {
    name: "Medical Leave",
    code: "ML",
    description: "Leave for medical treatment or illness.",
    isPaid: true,
    applicableTo: "ALL",
    annualLimit: 10,
    defaultAllocationDays: 10,
  },
  {
    name: "Maternity Leave",
    code: "MAT",
    description: "Leave for maternity purposes.",
    isPaid: true,
    applicableTo: "ALL",
    annualLimit: 180,
    defaultAllocationDays: 180,
    genderApplicability: "FEMALE",
  },
  {
    name: "Unpaid Leave",
    code: "UL",
    description: "Leave without pay for personal reasons.",
    isPaid: false,
    applicableTo: "ALL",
    annualLimit: 30,
    defaultAllocationDays: 30,
  },
  {
    name: "Study Leave",
    code: "SPL",
    description: "Leave for academic or professional study.",
    isPaid: true,
    applicableTo: "TEACHING",
    annualLimit: 15,
    defaultAllocationDays: 15,
  },
];

export type LeaveTypeInput = {
  name: string;
  code?: string | null;
  description?: string | null;
  annualLimit?: number | null;
  isPaid?: boolean;
  applicableTo?: string;
  isActive?: boolean;
  carryForward?: boolean;
  encashmentAllowed?: boolean;
  genderApplicability?: string;
  allocationMethod?: string;
  allocationFrequency?: string;
  defaultAllocationDays?: number;
  accrualRate?: number;
  accrualBased?: boolean;
  effectiveFrom?: Date | null;
  restriction?: string;
  requireApproval?: boolean;
  applyOnWeekends?: boolean;
  applyOnHolidays?: boolean;
  allowHalfDay?: boolean;
  minimumNoticeDays?: number;
  documentRequired?: string;
};

function money(value: Prisma.Decimal | number | null | undefined) {
  return Number(value ?? 0);
}

function mapLeaveType(row: {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  annualLimit: number | null;
  isPaid: boolean;
  applicableTo: string;
  isActive: boolean;
  carryForward: boolean;
  encashmentAllowed: boolean;
  genderApplicability: string;
  allocationMethod: string;
  allocationFrequency: string;
  defaultAllocationDays: number;
  accrualRate: Prisma.Decimal;
  accrualBased: boolean;
  effectiveFrom: Date | null;
  restriction: string;
  requireApproval: boolean;
  applyOnWeekends: boolean;
  applyOnHolidays: boolean;
  allowHalfDay: boolean;
  minimumNoticeDays: number;
  documentRequired: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    accrualRate: money(row.accrualRate),
  };
}

async function ensureDefaults(tenantId: string) {
  const existing = await prisma.staffLeaveType.findMany({
    where: { tenantId },
    select: { id: true, name: true, code: true, description: true },
  });
  const byName = new Map(existing.map((row) => [row.name.toLowerCase(), row]));

  for (const item of DEFAULT_TYPES) {
    const match = byName.get(item.name.toLowerCase());
    if (!match) {
      await prisma.staffLeaveType.create({
        data: {
          tenantId,
          name: item.name,
          code: item.code,
          description: item.description,
          isPaid: item.isPaid,
          applicableTo: item.applicableTo,
          annualLimit: item.annualLimit,
          defaultAllocationDays: item.defaultAllocationDays,
          genderApplicability: item.genderApplicability ?? "ALL",
        },
      });
      continue;
    }

    // Backfill code/description on older seed rows (e.g. Casual Leave → CASUAL).
    const needsCode = !match.code || match.code.toUpperCase() === "CASUAL";
    const needsDescription = !match.description;
    if (needsCode || needsDescription) {
      await prisma.staffLeaveType.update({
        where: { id: match.id },
        data: {
          ...(needsCode ? { code: item.code } : {}),
          ...(needsDescription ? { description: item.description } : {}),
        },
      });
    }
  }
}

export async function getLeaveTypesSetup(tenantId: string) {
  await ensureDefaults(tenantId);
  const leaveTypes = await prisma.staffLeaveType.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return {
    leaveTypes: leaveTypes.map(mapLeaveType),
    stats: {
      total: leaveTypes.length,
      active: leaveTypes.filter((item) => item.isActive).length,
      paid: leaveTypes.filter((item) => item.isPaid).length,
      unpaid: leaveTypes.filter((item) => !item.isPaid).length,
    },
  };
}

async function assertUniqueName(tenantId: string, name: string, excludeId?: string) {
  const exists = await prisma.staffLeaveType.findFirst({
    where: tenantScope(tenantId, {
      name,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    }),
    select: { id: true },
  });
  if (exists) throw new AppError(409, `Leave type "${name}" already exists`, "LEAVE_TYPE_EXISTS");
}

async function assertUniqueCode(tenantId: string, code: string | null | undefined, excludeId?: string) {
  if (!code) return;
  const exists = await prisma.staffLeaveType.findFirst({
    where: tenantScope(tenantId, {
      code,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    }),
    select: { id: true },
  });
  if (exists) throw new AppError(409, `Leave code "${code}" already exists`, "LEAVE_CODE_EXISTS");
}

export async function createLeaveType(tenantId: string, input: LeaveTypeInput) {
  const name = input.name.trim();
  const code = input.code?.trim().toUpperCase() || null;
  await assertUniqueName(tenantId, name);
  await assertUniqueCode(tenantId, code);

  const row = await prisma.staffLeaveType.create({
    data: {
      tenantId,
      name,
      code,
      description: input.description?.trim() || null,
      annualLimit: input.annualLimit ?? input.defaultAllocationDays ?? 12,
      isPaid: input.isPaid ?? true,
      applicableTo: input.applicableTo ?? "ALL",
      isActive: input.isActive ?? true,
      carryForward: input.carryForward ?? false,
      encashmentAllowed: input.encashmentAllowed ?? false,
      genderApplicability: input.genderApplicability ?? "ALL",
      allocationMethod: input.allocationMethod ?? "YEARLY",
      allocationFrequency: input.allocationFrequency ?? "ON_ANNIVERSARY",
      defaultAllocationDays: input.defaultAllocationDays ?? input.annualLimit ?? 12,
      accrualRate: input.accrualRate ?? 1,
      accrualBased: input.accrualBased ?? true,
      effectiveFrom: input.effectiveFrom ?? null,
      restriction: input.restriction ?? "NONE",
      requireApproval: input.requireApproval ?? true,
      applyOnWeekends: input.applyOnWeekends ?? false,
      applyOnHolidays: input.applyOnHolidays ?? false,
      allowHalfDay: input.allowHalfDay ?? true,
      minimumNoticeDays: input.minimumNoticeDays ?? 1,
      documentRequired: input.documentRequired ?? "NOT_REQUIRED",
    },
  });
  return mapLeaveType(row);
}

export async function updateLeaveType(tenantId: string, id: string, input: Partial<LeaveTypeInput>) {
  const found = await prisma.staffLeaveType.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Leave type not found", "LEAVE_TYPE_NOT_FOUND");

  if (input.name) await assertUniqueName(tenantId, input.name.trim(), id);
  if (input.code !== undefined) {
    await assertUniqueCode(tenantId, input.code?.trim().toUpperCase() || null, id);
  }

  const row = await prisma.staffLeaveType.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      code: input.code === undefined ? undefined : input.code?.trim().toUpperCase() || null,
      description:
        input.description === undefined ? undefined : input.description?.trim() || null,
      annualLimit: input.annualLimit,
      isPaid: input.isPaid,
      applicableTo: input.applicableTo,
      isActive: input.isActive,
      carryForward: input.carryForward,
      encashmentAllowed: input.encashmentAllowed,
      genderApplicability: input.genderApplicability,
      allocationMethod: input.allocationMethod,
      allocationFrequency: input.allocationFrequency,
      defaultAllocationDays: input.defaultAllocationDays,
      accrualRate: input.accrualRate,
      accrualBased: input.accrualBased,
      effectiveFrom: input.effectiveFrom,
      restriction: input.restriction,
      requireApproval: input.requireApproval,
      applyOnWeekends: input.applyOnWeekends,
      applyOnHolidays: input.applyOnHolidays,
      allowHalfDay: input.allowHalfDay,
      minimumNoticeDays: input.minimumNoticeDays,
      documentRequired: input.documentRequired,
    },
  });
  return mapLeaveType(row);
}

export async function deleteLeaveType(tenantId: string, id: string) {
  const found = await prisma.staffLeaveType.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Leave type not found", "LEAVE_TYPE_NOT_FOUND");
  const used = await prisma.staffLeave.count({
    where: tenantScope(tenantId, { leaveTypeId: id }),
  });
  if (used) {
    throw new AppError(409, "Leave type is used by existing leave records", "LEAVE_TYPE_IN_USE");
  }
  await prisma.staffLeaveType.delete({ where: { id } });
  return { ok: true };
}
