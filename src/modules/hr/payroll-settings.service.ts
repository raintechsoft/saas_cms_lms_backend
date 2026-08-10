import { AdjustmentType, Prisma, StaffStatus } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const DEFAULT_COMPONENTS: Array<{
  name: string;
  shortCode: string;
  type: AdjustmentType;
  taxable: boolean;
  defaultAmount: number;
}> = [
  { name: "Basic Salary", shortCode: "BASIC", type: "EARNING", taxable: true, defaultAmount: 0 },
  { name: "House Rent Allowance", shortCode: "HRA", type: "EARNING", taxable: true, defaultAmount: 0 },
  { name: "Dearness Allowance", shortCode: "DA", type: "EARNING", taxable: true, defaultAmount: 0 },
  { name: "Special Allowance", shortCode: "SA", type: "EARNING", taxable: true, defaultAmount: 0 },
  { name: "Transport Allowance", shortCode: "TA", type: "EARNING", taxable: false, defaultAmount: 0 },
  { name: "Provident Fund", shortCode: "PF", type: "DEDUCTION", taxable: false, defaultAmount: 0 },
  { name: "Professional Tax", shortCode: "PT", type: "DEDUCTION", taxable: false, defaultAmount: 0 },
  { name: "Income Tax", shortCode: "IT", type: "DEDUCTION", taxable: false, defaultAmount: 0 },
  { name: "ESI", shortCode: "ESI", type: "DEDUCTION", taxable: false, defaultAmount: 0 },
];

export type PayrollSettingsInput = {
  payrollFrequency?: string;
  financialYear?: string;
  payDay?: number;
  paymentMethod?: string;
  salaryCalculationMethod?: string;
  roundingOff?: string;
  incomeTaxCalculation?: string;
  arrearCalculation?: boolean;
  autoRecalculate?: boolean;
  generatePayslip?: boolean;
  emailPayslip?: boolean;
  lockPayrollAfterApproval?: boolean;
  pfScheme?: string;
  esiApplicability?: string;
  epfNumber?: string | null;
  esiNumber?: string | null;
  professionalTax?: string;
  labourWelfareFund?: string;
  payStructure?: string;
  allowNegativeSalary?: boolean;
  minimumPayLimit?: number;
  maximumPayLimit?: number;
  overtimeCalculation?: string;
  leaveEncashment?: string;
  preparedByRole?: string;
  reviewedByRole?: string;
  approvedByRole?: string;
};

export type PayComponentInput = {
  name: string;
  shortCode?: string | null;
  type: AdjustmentType;
  taxable?: boolean;
  isActive?: boolean;
  defaultAmount?: number;
};

function money(value: Prisma.Decimal | number | null | undefined) {
  return Number(value ?? 0);
}

function currentFinancialYear(now = new Date()) {
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function periodLabel(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt(start)} - ${fmt(end)}`;
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

function mapSettings(row: {
  payrollFrequency: string;
  financialYear: string;
  payDay: number;
  paymentMethod: string;
  salaryCalculationMethod: string;
  roundingOff: string;
  incomeTaxCalculation: string;
  arrearCalculation: boolean;
  autoRecalculate: boolean;
  generatePayslip: boolean;
  emailPayslip: boolean;
  lockPayrollAfterApproval: boolean;
  pfScheme: string;
  esiApplicability: string;
  epfNumber: string | null;
  esiNumber: string | null;
  professionalTax: string;
  labourWelfareFund: string;
  payStructure: string;
  allowNegativeSalary: boolean;
  minimumPayLimit: Prisma.Decimal;
  maximumPayLimit: Prisma.Decimal;
  overtimeCalculation: string;
  leaveEncashment: string;
  preparedByRole: string;
  reviewedByRole: string;
  approvedByRole: string;
}) {
  return {
    payrollFrequency: row.payrollFrequency,
    financialYear: row.financialYear,
    payDay: row.payDay,
    paymentMethod: row.paymentMethod,
    salaryCalculationMethod: row.salaryCalculationMethod,
    roundingOff: row.roundingOff,
    incomeTaxCalculation: row.incomeTaxCalculation,
    arrearCalculation: row.arrearCalculation,
    autoRecalculate: row.autoRecalculate,
    generatePayslip: row.generatePayslip,
    emailPayslip: row.emailPayslip,
    lockPayrollAfterApproval: row.lockPayrollAfterApproval,
    pfScheme: row.pfScheme,
    esiApplicability: row.esiApplicability,
    epfNumber: row.epfNumber,
    esiNumber: row.esiNumber,
    professionalTax: row.professionalTax,
    labourWelfareFund: row.labourWelfareFund,
    payStructure: row.payStructure,
    allowNegativeSalary: row.allowNegativeSalary,
    minimumPayLimit: money(row.minimumPayLimit),
    maximumPayLimit: money(row.maximumPayLimit),
    overtimeCalculation: row.overtimeCalculation,
    leaveEncashment: row.leaveEncashment,
    preparedByRole: row.preparedByRole,
    reviewedByRole: row.reviewedByRole,
    approvedByRole: row.approvedByRole,
  };
}

function mapComponent(row: {
  id: string;
  name: string;
  shortCode: string | null;
  type: AdjustmentType;
  taxable: boolean;
  isActive: boolean;
  defaultAmount: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    shortCode: row.shortCode,
    type: row.type,
    taxable: row.taxable,
    isActive: row.isActive,
    defaultAmount: money(row.defaultAmount),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ensureDefaults(tenantId: string) {
  const settings = await prisma.tenantPayrollSetting.upsert({
    where: { tenantId },
    create: {
      tenantId,
      financialYear: currentFinancialYear(),
    },
    update: {},
  });

  const existing = await prisma.payParameter.findMany({
    where: { tenantId },
    select: { id: true, name: true, shortCode: true },
  });
  const byName = new Map(existing.map((row) => [row.name.toLowerCase(), row]));

  for (const item of DEFAULT_COMPONENTS) {
    const match = byName.get(item.name.toLowerCase());
    if (!match) {
      await prisma.payParameter.create({
        data: {
          tenantId,
          name: item.name,
          shortCode: item.shortCode,
          type: item.type,
          taxable: item.taxable,
          defaultAmount: item.defaultAmount,
          isActive: true,
        },
      });
      continue;
    }
    if (!match.shortCode) {
      await prisma.payParameter.update({
        where: { id: match.id },
        data: { shortCode: item.shortCode, taxable: item.taxable },
      });
    }
  }

  return settings;
}

export async function getPayrollSettingsSetup(tenantId: string) {
  const settingsRow = await ensureDefaults(tenantId);

  const [components, activeEmployees, payrollRows] = await Promise.all([
    prisma.payParameter.findMany({
      where: { tenantId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.staffProfile.count({
      where: { tenantId, status: StaffStatus.ACTIVE },
    }),
    prisma.payroll.findMany({
      where: { tenantId },
      orderBy: { payrollMonth: "desc" },
      take: 500,
      select: {
        id: true,
        payrollMonth: true,
        grossAmount: true,
        netAmount: true,
        status: true,
        updatedAt: true,
        paidAt: true,
        staff: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  const grouped = new Map<
    string,
    {
      payrollMonth: Date;
      employees: number;
      grossAmount: number;
      netAmount: number;
      status: string;
      processedOn: Date;
      processedBy: string;
    }
  >();

  for (const row of payrollRows) {
    const key = monthKey(row.payrollMonth);
    const existing = grouped.get(key);
    const processedBy = [row.staff.user.firstName, row.staff.user.lastName].filter(Boolean).join(" ") || "—";
    if (!existing) {
      grouped.set(key, {
        payrollMonth: row.payrollMonth,
        employees: 1,
        grossAmount: money(row.grossAmount),
        netAmount: money(row.netAmount),
        status: row.status === "PAID" ? "COMPLETED" : "APPROVED",
        processedOn: row.paidAt ?? row.updatedAt,
        processedBy,
      });
    } else {
      existing.employees += 1;
      existing.grossAmount += money(row.grossAmount);
      existing.netAmount += money(row.netAmount);
      if ((row.paidAt ?? row.updatedAt) > existing.processedOn) {
        existing.processedOn = row.paidAt ?? row.updatedAt;
        existing.processedBy = processedBy;
      }
      if (row.status === "PAID") existing.status = "COMPLETED";
    }
  }

  const history = Array.from(grouped.values())
    .sort((a, b) => b.payrollMonth.getTime() - a.payrollMonth.getTime())
    .slice(0, 12)
    .map((item, index) => ({
      id: monthKey(item.payrollMonth),
      index: index + 1,
      payrollMonth: monthLabel(item.payrollMonth),
      payrollPeriod: periodLabel(item.payrollMonth),
      employees: item.employees,
      grossAmount: item.grossAmount,
      netAmount: item.netAmount,
      status: item.status,
      processedBy: item.processedBy,
      processedOn: item.processedOn,
    }));

  const now = new Date();
  const payDay = Math.min(Math.max(settingsRow.payDay, 1), 31);
  const thisMonthLast = lastDayOfMonth(now.getUTCFullYear(), now.getUTCMonth());
  const nextRunDay = Math.min(payDay, thisMonthLast.getUTCDate());
  let nextRun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), nextRunDay));
  if (nextRun.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
    const nextMonthLast = lastDayOfMonth(now.getUTCFullYear(), now.getUTCMonth() + 1);
    nextRun = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        Math.min(payDay, nextMonthLast.getUTCDate()),
      ),
    );
  }

  const lastHistory = history[0] ?? null;

  return {
    settings: mapSettings(settingsRow),
    components: components.map(mapComponent),
    summary: {
      totalEmployees: activeEmployees,
      payrollFrequency: settingsRow.payrollFrequency,
      nextPayrollRun: nextRun.toISOString(),
      nextPayrollFor: monthLabel(nextRun),
      lastPayrollRun: lastHistory?.processedOn?.toISOString() ?? null,
      lastPayrollFor: lastHistory?.payrollMonth ?? null,
    },
    history,
  };
}

export async function updatePayrollSettings(tenantId: string, input: PayrollSettingsInput) {
  await ensureDefaults(tenantId);

  if (input.minimumPayLimit != null && input.maximumPayLimit != null) {
    if (input.minimumPayLimit > input.maximumPayLimit) {
      throw new AppError(400, "Minimum pay limit cannot exceed maximum pay limit", "INVALID_PAY_LIMIT");
    }
  }

  const row = await prisma.tenantPayrollSetting.update({
    where: { tenantId },
    data: {
      ...(input.payrollFrequency != null ? { payrollFrequency: input.payrollFrequency } : {}),
      ...(input.financialYear != null ? { financialYear: input.financialYear } : {}),
      ...(input.payDay != null ? { payDay: input.payDay } : {}),
      ...(input.paymentMethod != null ? { paymentMethod: input.paymentMethod } : {}),
      ...(input.salaryCalculationMethod != null
        ? { salaryCalculationMethod: input.salaryCalculationMethod }
        : {}),
      ...(input.roundingOff != null ? { roundingOff: input.roundingOff } : {}),
      ...(input.incomeTaxCalculation != null ? { incomeTaxCalculation: input.incomeTaxCalculation } : {}),
      ...(input.arrearCalculation != null ? { arrearCalculation: input.arrearCalculation } : {}),
      ...(input.autoRecalculate != null ? { autoRecalculate: input.autoRecalculate } : {}),
      ...(input.generatePayslip != null ? { generatePayslip: input.generatePayslip } : {}),
      ...(input.emailPayslip != null ? { emailPayslip: input.emailPayslip } : {}),
      ...(input.lockPayrollAfterApproval != null
        ? { lockPayrollAfterApproval: input.lockPayrollAfterApproval }
        : {}),
      ...(input.pfScheme != null ? { pfScheme: input.pfScheme } : {}),
      ...(input.esiApplicability != null ? { esiApplicability: input.esiApplicability } : {}),
      ...(input.epfNumber !== undefined ? { epfNumber: input.epfNumber?.trim() || null } : {}),
      ...(input.esiNumber !== undefined ? { esiNumber: input.esiNumber?.trim() || null } : {}),
      ...(input.professionalTax != null ? { professionalTax: input.professionalTax } : {}),
      ...(input.labourWelfareFund != null ? { labourWelfareFund: input.labourWelfareFund } : {}),
      ...(input.payStructure != null ? { payStructure: input.payStructure } : {}),
      ...(input.allowNegativeSalary != null ? { allowNegativeSalary: input.allowNegativeSalary } : {}),
      ...(input.minimumPayLimit != null ? { minimumPayLimit: input.minimumPayLimit } : {}),
      ...(input.maximumPayLimit != null ? { maximumPayLimit: input.maximumPayLimit } : {}),
      ...(input.overtimeCalculation != null ? { overtimeCalculation: input.overtimeCalculation } : {}),
      ...(input.leaveEncashment != null ? { leaveEncashment: input.leaveEncashment } : {}),
      ...(input.preparedByRole != null ? { preparedByRole: input.preparedByRole } : {}),
      ...(input.reviewedByRole != null ? { reviewedByRole: input.reviewedByRole } : {}),
      ...(input.approvedByRole != null ? { approvedByRole: input.approvedByRole } : {}),
    },
  });

  return mapSettings(row);
}

async function assertUniqueComponentName(tenantId: string, name: string, excludeId?: string) {
  const exists = await prisma.payParameter.findFirst({
    where: tenantScope(tenantId, {
      name,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    }),
    select: { id: true },
  });
  if (exists) throw new AppError(409, `Component "${name}" already exists`, "PAY_COMPONENT_EXISTS");
}

async function assertUniqueShortCode(tenantId: string, shortCode: string | null | undefined, excludeId?: string) {
  if (!shortCode) return;
  const exists = await prisma.payParameter.findFirst({
    where: tenantScope(tenantId, {
      shortCode,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    }),
    select: { id: true },
  });
  if (exists) throw new AppError(409, `Short code "${shortCode}" already exists`, "PAY_CODE_EXISTS");
}

export async function createPayComponent(tenantId: string, input: PayComponentInput) {
  const name = input.name.trim();
  const shortCode = input.shortCode?.trim().toUpperCase() || null;
  await assertUniqueComponentName(tenantId, name);
  await assertUniqueShortCode(tenantId, shortCode);

  const row = await prisma.payParameter.create({
    data: {
      tenantId,
      name,
      shortCode,
      type: input.type,
      taxable: input.taxable ?? input.type === "EARNING",
      isActive: input.isActive ?? true,
      defaultAmount: input.defaultAmount ?? 0,
    },
  });
  return mapComponent(row);
}

export async function updatePayComponent(tenantId: string, id: string, input: Partial<PayComponentInput>) {
  const found = await prisma.payParameter.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Pay component not found", "PAY_COMPONENT_NOT_FOUND");

  if (input.name != null) await assertUniqueComponentName(tenantId, input.name.trim(), id);
  const shortCode =
    input.shortCode !== undefined ? input.shortCode?.trim().toUpperCase() || null : undefined;
  if (shortCode !== undefined) await assertUniqueShortCode(tenantId, shortCode, id);

  const row = await prisma.payParameter.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(shortCode !== undefined ? { shortCode } : {}),
      ...(input.type != null ? { type: input.type } : {}),
      ...(input.taxable != null ? { taxable: input.taxable } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
      ...(input.defaultAmount != null ? { defaultAmount: input.defaultAmount } : {}),
    },
  });
  return mapComponent(row);
}

export async function deletePayComponent(tenantId: string, id: string) {
  const found = await prisma.payParameter.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Pay component not found", "PAY_COMPONENT_NOT_FOUND");
  await prisma.payParameter.delete({ where: { id } });
  return { id };
}
