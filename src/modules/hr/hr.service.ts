import {
  AdjustmentType,
  PayrollStatus,
  StaffAttendanceStatus,
  StaffLeaveStatus,
  StaffStatus,
  UserStatus,
  type PaymentMode,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { AppError } from "../../lib/errors.js";
import { isMailConfigured, sendMail } from "../../lib/mail.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

// Unambiguous characters only (no 0/O, 1/l/I) so the password is easy to share.
const TEMP_PASSWORD_CHARSET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateTempPassword(length = 10) {
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += TEMP_PASSWORD_CHARSET[randomInt(TEMP_PASSWORD_CHARSET.length)];
  }
  return password;
}

function monthBounds(value: Date) {
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  const end = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
  return { start, end };
}

async function requireStaff(tenantId: string, staffId: string) {
  const staff = await prisma.staffProfile.findFirst({
    where: tenantScope(tenantId, { id: staffId }),
    include: { user: true, department: true, designation: true },
  });
  if (!staff) throw new AppError(404, "Staff member not found", "STAFF_NOT_FOUND");
  return staff;
}

export async function getHrSetup(tenantId: string, month = new Date()) {
  const { start, end } = monthBounds(month);
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  const setting = await prisma.tenantSetting.findUnique({ where: { tenantId } });
  const [
    departments,
    designations,
    leaveTypes,
    payParameters,
    staff,
    pendingLeaves,
    leaves,
    payrolls,
  ] = await Promise.all([
      prisma.department.findMany({ where: tenantScope(tenantId, {}), orderBy: { name: "asc" } }),
      prisma.designation.findMany({ where: tenantScope(tenantId, {}), orderBy: { name: "asc" } }),
      prisma.staffLeaveType.findMany({ where: tenantScope(tenantId, {}), orderBy: { name: "asc" } }),
      prisma.payParameter.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      prisma.staffProfile.findMany({
        where: tenantScope(tenantId, {}),
        // Documents are base64 payloads; exclude them from the list to keep
        // the setup response small.
        omit: { documents: true },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true,
            },
          },
          department: true,
          designation: true,
          attendance: { where: { attendanceDate: { gte: start, lte: end } } },
          _count: { select: { leaves: true, ratings: true } },
        },
        orderBy: { employeeNumber: "asc" },
      }),
      prisma.staffLeave.findMany({
        where: tenantScope(tenantId, { status: StaffLeaveStatus.PENDING }),
        omit: { attachment: true },
        include: { staff: { include: { user: true } }, leaveType: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.staffLeave.findMany({
        where: tenantScope(tenantId, {}),
        omit: { attachment: true },
        include: {
          staff: { include: { user: true, designation: true } },
          leaveType: true,
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.payroll.findMany({
        where: tenantScope(tenantId, { payrollMonth: start }),
        include: { staff: { include: { user: true } }, items: true },
        orderBy: { staff: { employeeNumber: "asc" } },
      }),
    ]);
  return {
    month: start,
    currentSession,
    departments,
    designations,
    leaveTypes,
    payParameters,
    staff,
    pendingLeaves,
    leaves,
    payrolls,
    staffNumbering: {
      auto: setting?.autoStaffNumber ?? false,
      prefix: setting?.staffPrefix ?? "STF-",
      digits: setting?.staffNumberDigits ?? 4,
      next: setting?.nextStaffNumber ?? 1,
    },
  };
}

export async function createDepartment(tenantId: string, name: string) {
  return prisma.department.create({ data: { tenantId, name } });
}

export async function updateDepartment(tenantId: string, id: string, name: string) {
  const found = await prisma.department.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Department not found", "DEPARTMENT_NOT_FOUND");
  return prisma.department.update({ where: { id }, data: { name } });
}

export async function deleteDepartment(tenantId: string, id: string) {
  const found = await prisma.department.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Department not found", "DEPARTMENT_NOT_FOUND");
  await prisma.department.delete({ where: { id } });
}

export async function createDesignation(tenantId: string, name: string) {
  return prisma.designation.create({ data: { tenantId, name } });
}

export async function updateDesignation(tenantId: string, id: string, name: string) {
  const found = await prisma.designation.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Designation not found", "DESIGNATION_NOT_FOUND");
  return prisma.designation.update({ where: { id }, data: { name } });
}

export async function deleteDesignation(tenantId: string, id: string) {
  const found = await prisma.designation.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Designation not found", "DESIGNATION_NOT_FOUND");
  await prisma.designation.delete({ where: { id } });
}

export async function createStaffLeaveType(
  tenantId: string,
  input: Parameters<typeof import("./leave-types-settings.service.js").createLeaveType>[1],
) {
  const { createLeaveType } = await import("./leave-types-settings.service.js");
  return createLeaveType(tenantId, input);
}

export async function updateStaffLeaveType(
  tenantId: string,
  id: string,
  input: Parameters<typeof import("./leave-types-settings.service.js").updateLeaveType>[2],
) {
  const { updateLeaveType } = await import("./leave-types-settings.service.js");
  return updateLeaveType(tenantId, id, input);
}

export async function deleteStaffLeaveType(tenantId: string, id: string) {
  const { deleteLeaveType } = await import("./leave-types-settings.service.js");
  return deleteLeaveType(tenantId, id);
}

export async function createPayParameter(
  tenantId: string,
  input: {
    name: string;
    type: AdjustmentType;
    defaultAmount: number;
    shortCode?: string | null;
    taxable?: boolean;
    isActive?: boolean;
  },
) {
  const exists = await prisma.payParameter.findFirst({
    where: tenantScope(tenantId, { name: input.name }),
  });
  if (exists) throw new AppError(409, "Parameter already exists", "PARAMETER_EXISTS");
  return prisma.payParameter.create({
    data: {
      tenantId,
      name: input.name,
      type: input.type,
      defaultAmount: input.defaultAmount,
      shortCode: input.shortCode?.trim().toUpperCase() || null,
      taxable: input.taxable ?? input.type === "EARNING",
      isActive: input.isActive ?? true,
    },
  });
}

export async function updatePayParameter(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    type?: AdjustmentType;
    defaultAmount?: number;
    shortCode?: string | null;
    taxable?: boolean;
    isActive?: boolean;
  },
) {
  const found = await prisma.payParameter.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Parameter not found", "PARAMETER_NOT_FOUND");
  return prisma.payParameter.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.type != null ? { type: input.type } : {}),
      ...(input.defaultAmount != null ? { defaultAmount: input.defaultAmount } : {}),
      ...(input.shortCode !== undefined
        ? { shortCode: input.shortCode?.trim().toUpperCase() || null }
        : {}),
      ...(input.taxable != null ? { taxable: input.taxable } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deletePayParameter(tenantId: string, id: string) {
  const found = await prisma.payParameter.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Parameter not found", "PARAMETER_NOT_FOUND");
  await prisma.payParameter.delete({ where: { id } });
}

const STAFF_ROLE_CODES = new Set(["INSTITUTION_ADMIN", "TEACHER", "ACCOUNTANT", "STAFF"]);

export interface StaffDetailsInput {
  employeeNumber?: string;
  departmentId?: string | null;
  designationId?: string | null;
  joiningDate: Date;
  dateOfBirth?: Date | null;
  phone?: string | null;
  address?: string | null;
  basicSalary: number;
  gender?: string | null;
  maritalStatus?: string | null;
  emergencyContact?: string | null;
  epfNumber?: string | null;
  contractType?: string | null;
  workShift?: string | null;
  workLocation?: string | null;
  leaveAllowance?: number | null;
  absenceDeduction?: number | null;
  leavingDate?: Date | null;
  resignationLetter?: string | null;
  bankAccountTitle?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  permanentAddress?: string | null;
  photoUrl?: string | null;
  documents?: Array<{ label: string; name: string; dataUrl: string }> | null;
}

export async function createStaffProfile(
  tenantId: string,
  input: StaffDetailsInput & {
    userId?: string;
    newUser?: { firstName: string; lastName: string; email: string; roleCode: string };
    adjustments?: Array<{
      name: string;
      type: AdjustmentType;
      amount: number;
      isRecurring?: boolean;
    }>;
  },
) {
  if (!input.userId && !input.newUser) {
    throw new AppError(400, "Provide an existing user or new staff details", "USER_REQUIRED");
  }
  let roleId: string | null = null;
  if (input.userId) {
    const user = await prisma.user.findFirst({
      where: tenantScope(tenantId, { id: input.userId, status: UserStatus.ACTIVE }),
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new AppError(400, "Tenant user is invalid", "INVALID_USER");
    if (!user.roles.some(({ role }) => STAFF_ROLE_CODES.has(role.code))) {
      throw new AppError(
        400,
        "User must have an institution staff role",
        "INVALID_STAFF_ROLE",
      );
    }
    const existingProfile = await prisma.staffProfile.findFirst({
      where: tenantScope(tenantId, { userId: input.userId }),
    });
    if (existingProfile) {
      throw new AppError(409, "User already has a staff profile", "STAFF_EXISTS");
    }
  } else if (input.newUser) {
    if (!STAFF_ROLE_CODES.has(input.newUser.roleCode)) {
      throw new AppError(400, "Role must be an institution staff role", "INVALID_STAFF_ROLE");
    }
    const email = input.newUser.email.trim().toLowerCase();
    const exists = await prisma.user.findFirst({ where: tenantScope(tenantId, { email }) });
    if (exists) throw new AppError(409, "Email already exists", "USER_EXISTS");
    const role = await prisma.role.findFirst({
      where: { tenantId, code: input.newUser.roleCode },
    });
    if (!role) {
      throw new AppError(400, "Selected role is not configured for this tenant", "INVALID_ROLE");
    }
    roleId = role.id;
  }
  if (input.departmentId) {
    const count = await prisma.department.count({
      where: tenantScope(tenantId, { id: input.departmentId }),
    });
    if (!count) throw new AppError(400, "Department is invalid", "INVALID_DEPARTMENT");
  }
  if (input.designationId) {
    const count = await prisma.designation.count({
      where: tenantScope(tenantId, { id: input.designationId }),
    });
    if (!count) throw new AppError(400, "Designation is invalid", "INVALID_DESIGNATION");
  }
  const tempPassword = input.newUser ? generateTempPassword() : null;
  const tempPasswordHash = tempPassword ? await bcrypt.hash(tempPassword, 12) : null;
  const profile = await prisma.$transaction(async (tx) => {
    let employeeNumber = input.employeeNumber?.trim();
    if (!employeeNumber) {
      const setting = await tx.tenantSetting.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      });
      if (!setting.autoStaffNumber) {
        throw new AppError(
          400,
          "Employee number is required unless auto staff numbering is enabled",
          "EMPLOYEE_NUMBER_REQUIRED",
        );
      }
      const updated = await tx.tenantSetting.update({
        where: { tenantId },
        data: { nextStaffNumber: { increment: 1 } },
      });
      const sequence = updated.nextStaffNumber - 1;
      const digits = Math.max(1, updated.staffNumberDigits ?? 4);
      employeeNumber = `${updated.staffPrefix ?? setting.staffPrefix ?? "STF-"}${String(sequence).padStart(digits, "0")}`;
    }
    let userId = input.userId;
    if (!userId && input.newUser) {
      const user = await tx.user.create({
        data: {
          tenantId,
          email: input.newUser.email.trim().toLowerCase(),
          passwordHash: tempPasswordHash,
          firstName: input.newUser.firstName.trim(),
          lastName: input.newUser.lastName.trim(),
          phone: input.phone ?? null,
          ...(roleId ? { roles: { create: [{ roleId, tenantId }] } } : {}),
        },
      });
      userId = user.id;
    }
    const {
      employeeNumber: _ignored,
      userId: _userId,
      newUser: _newUser,
      adjustments,
      documents,
      ...details
    } = input;
    const created = await tx.staffProfile.create({
      data: {
        tenantId,
        userId: userId!,
        employeeNumber,
        ...details,
        documents: documents ?? undefined,
      },
      include: { user: true, department: true, designation: true },
    });
    if (adjustments?.length) {
      await tx.staffAdjustment.createMany({
        data: adjustments.map((item) => ({
          tenantId,
          staffId: created.id,
          name: item.name,
          type: item.type,
          amount: item.amount,
          isRecurring: item.isRecurring ?? true,
        })),
      });
    }
    return created;
  });
  if (tempPassword && isMailConfigured()) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const workspaceName = tenant?.name ?? "SaaS CMS LMS";
    // Email failures must not roll back the created staff record.
    sendMail({
      tenantId,
      to: profile.user.email,
      subject: `Your ${workspaceName} staff account`,
      text: [
        `Hello ${profile.user.firstName},`,
        "",
        `A staff account has been created for you at ${workspaceName}.`,
        "",
        `Email: ${profile.user.email}`,
        `Temporary password: ${tempPassword}`,
        "",
        "Please sign in and change your password from your profile page.",
        "",
        "SaaS CMS LMS",
      ].join("\n"),
    }).catch(() => undefined);
  }
  return { ...profile, tempPassword };
}

export async function updateStaffProfile(
  tenantId: string,
  staffId: string,
  input: Partial<StaffDetailsInput>,
) {
  await requireStaff(tenantId, staffId);
  if (input.departmentId) {
    const count = await prisma.department.count({
      where: tenantScope(tenantId, { id: input.departmentId }),
    });
    if (!count) throw new AppError(400, "Department is invalid", "INVALID_DEPARTMENT");
  }
  if (input.designationId) {
    const count = await prisma.designation.count({
      where: tenantScope(tenantId, { id: input.designationId }),
    });
    if (!count) throw new AppError(400, "Designation is invalid", "INVALID_DESIGNATION");
  }
  if (input.employeeNumber) {
    const duplicate = await prisma.staffProfile.findFirst({
      where: tenantScope(tenantId, {
        employeeNumber: input.employeeNumber,
        id: { not: staffId },
      }),
    });
    if (duplicate) {
      throw new AppError(409, "Employee number is already in use", "EMPLOYEE_NUMBER_TAKEN");
    }
  }
  const { documents, ...rest } = input;
  const data = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  return prisma.staffProfile.update({
    where: { id: staffId },
    data: {
      ...data,
      ...(documents !== undefined ? { documents: documents ?? undefined } : {}),
    },
    include: { user: true, department: true, designation: true },
  });
}

export async function updateStaffStatus(
  tenantId: string,
  staffId: string,
  input: {
    status: StaffStatus;
    disabledReason?: string | null;
    leavingDate?: Date | null;
    resignationLetter?: string | null;
  },
) {
  await requireStaff(tenantId, staffId);
  if (input.status === StaffStatus.DISABLED && !input.disabledReason?.trim()) {
    throw new AppError(400, "A reason is required to disable staff", "DISABLE_REASON_REQUIRED");
  }
  return prisma.staffProfile.update({
    where: { id: staffId },
    data: {
      status: input.status,
      disabledReason: input.status === StaffStatus.DISABLED ? input.disabledReason : null,
      leavingDate:
        input.status === StaffStatus.DISABLED
          ? (input.leavingDate ?? new Date())
          : null,
      resignationLetter:
        input.status === StaffStatus.DISABLED ? (input.resignationLetter ?? null) : null,
      user: {
        update: {
          status: input.status === StaffStatus.ACTIVE ? UserStatus.ACTIVE : UserStatus.DISABLED,
        },
      },
    },
    include: { user: true, department: true, designation: true },
  });
}

export async function markStaffAttendance(
  tenantId: string,
  userId: string,
  input: {
    attendanceDate: Date;
    records: Array<{
      staffId: string;
      status: StaffAttendanceStatus;
      inTime?: string | null;
      outTime?: string | null;
      note?: string | null;
    }>;
  },
) {
  const ids = [...new Set(input.records.map((record) => record.staffId))];
  if (ids.length !== input.records.length) {
    throw new AppError(400, "Duplicate staff attendance entry", "DUPLICATE_ATTENDANCE");
  }
  const count = await prisma.staffProfile.count({
    where: tenantScope(tenantId, { id: { in: ids }, status: StaffStatus.ACTIVE }),
  });
  if (count !== ids.length) {
    throw new AppError(400, "One or more active staff records are invalid", "INVALID_STAFF");
  }
  const lockedByLeave = await prisma.staffLeave.findMany({
    where: tenantScope(tenantId, {
      staffId: { in: ids },
      status: StaffLeaveStatus.APPROVED,
      fromDate: { lte: input.attendanceDate },
      toDate: { gte: input.attendanceDate },
    }),
    select: { staffId: true },
  });
  if (lockedByLeave.length) {
    const locked = new Set(lockedByLeave.map((item) => item.staffId));
    const blocked = input.records.filter((record) => locked.has(record.staffId));
    if (blocked.length) {
      throw new AppError(
        409,
        "Cannot change attendance for staff on approved leave",
        "LEAVE_LOCKED_ATTENDANCE",
      );
    }
  }
  await prisma.$transaction(
    input.records.map((record) =>
      prisma.staffAttendance.upsert({
        where: {
          tenantId_staffId_attendanceDate: {
            tenantId,
            staffId: record.staffId,
            attendanceDate: input.attendanceDate,
          },
        },
        create: {
          tenantId,
          attendanceDate: input.attendanceDate,
          markedById: userId,
          ...record,
        },
        update: {
          status: record.status,
          inTime: record.inTime,
          outTime: record.outTime,
          note: record.note,
          markedById: userId,
        },
      }),
    ),
  );
  return getStaffAttendanceReport(tenantId, {
    from: input.attendanceDate,
    to: input.attendanceDate,
  });
}

export async function getStaffAttendanceReport(
  tenantId: string,
  query: { from: Date; to: Date; staffId?: string },
) {
  if (query.to < query.from) {
    throw new AppError(400, "Invalid report date range", "INVALID_DATE_RANGE");
  }
  return prisma.staffAttendance.findMany({
    where: tenantScope(tenantId, {
      attendanceDate: { gte: query.from, lte: query.to },
      ...(query.staffId ? { staffId: query.staffId } : {}),
    }),
    include: {
      staff: {
        include: { user: true, department: true, designation: true },
      },
    },
    orderBy: [{ attendanceDate: "desc" }, { staff: { employeeNumber: "asc" } }],
  });
}

export async function applyStaffLeave(
  tenantId: string,
  input: {
    staffId: string;
    leaveTypeId: string;
    fromDate: Date;
    toDate: Date;
    reason: string;
    attachment?: { name: string; dataUrl: string } | null;
  },
) {
  if (input.toDate < input.fromDate) {
    throw new AppError(400, "Invalid leave date range", "INVALID_DATE_RANGE");
  }
  const staff = await requireStaff(tenantId, input.staffId);
  const leaveType = await prisma.staffLeaveType.findFirst({
    where: tenantScope(tenantId, { id: input.leaveTypeId }),
  });
  if (!leaveType) throw new AppError(400, "Leave type is invalid", "INVALID_LEAVE_TYPE");
  const overlap = await prisma.staffLeave.findFirst({
    where: tenantScope(tenantId, {
      staffId: input.staffId,
      status: { in: [StaffLeaveStatus.PENDING, StaffLeaveStatus.APPROVED] },
      fromDate: { lte: input.toDate },
      toDate: { gte: input.fromDate },
    }),
  });
  if (overlap) throw new AppError(409, "Leave dates overlap an existing request", "LEAVE_OVERLAP");

  const requestedDays = leaveDayCount(input.fromDate, input.toDate);
  const yearStart = new Date(Date.UTC(input.fromDate.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(input.fromDate.getUTCFullYear(), 11, 31));
  const yearLeaves = await prisma.staffLeave.findMany({
    where: tenantScope(tenantId, {
      staffId: input.staffId,
      leaveTypeId: input.leaveTypeId,
      status: { in: [StaffLeaveStatus.PENDING, StaffLeaveStatus.APPROVED] },
      fromDate: { lte: yearEnd },
      toDate: { gte: yearStart },
    }),
  });
  const usedDays = yearLeaves.reduce(
    (sum, item) => sum + leaveDayCount(item.fromDate, item.toDate),
    0,
  );
  const typeLimit = leaveType.annualLimit;
  const staffLimit = staff.leaveAllowance;
  const limit =
    typeLimit != null && staffLimit != null
      ? Math.min(typeLimit, staffLimit)
      : (typeLimit ?? staffLimit ?? null);
  if (limit != null && usedDays + requestedDays > limit) {
    throw new AppError(
      400,
      `Leave quota exceeded (${usedDays + requestedDays}/${limit} days)`,
      "LEAVE_QUOTA_EXCEEDED",
    );
  }

  const { attachment, ...rest } = input;
  return prisma.staffLeave.create({
    data: { tenantId, ...rest, attachment: attachment ?? undefined },
    include: { staff: { include: { user: true } }, leaveType: true },
  });
}

function leaveDayCount(fromDate: Date, toDate: Date) {
  const start = Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate());
  const end = Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate());
  return Math.floor((end - start) / 86_400_000) + 1;
}

function eachLeaveDate(fromDate: Date, toDate: Date) {
  const days: Date[] = [];
  const cur = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  const end = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export async function getStaffLeave(tenantId: string, leaveId: string) {
  const leave = await prisma.staffLeave.findFirst({
    where: tenantScope(tenantId, { id: leaveId }),
    include: {
      staff: { include: { user: true, designation: true } },
      leaveType: true,
    },
  });
  if (!leave) throw new AppError(404, "Leave request not found", "LEAVE_NOT_FOUND");
  return leave;
}

export async function reviewStaffLeave(
  tenantId: string,
  userId: string,
  leaveId: string,
  input: { status: StaffLeaveStatus; reviewNote?: string | null },
) {
  const leave = await prisma.staffLeave.findFirst({
    where: tenantScope(tenantId, { id: leaveId }),
    include: { leaveType: true },
  });
  if (!leave) throw new AppError(404, "Leave request not found", "LEAVE_NOT_FOUND");
  const backToPending = input.status === StaffLeaveStatus.PENDING;
  const updated = await prisma.staffLeave.update({
    where: { id: leaveId },
    data: {
      status: input.status,
      reviewNote: input.reviewNote,
      reviewedById: backToPending ? null : userId,
      reviewedAt: backToPending ? null : new Date(),
    },
    include: { staff: { include: { user: true, designation: true } }, leaveType: true },
  });

  if (input.status === StaffLeaveStatus.APPROVED) {
    const note = `Approved leave: ${leave.leaveType.name}`;
    await prisma.$transaction(
      eachLeaveDate(leave.fromDate, leave.toDate).map((attendanceDate) =>
        prisma.staffAttendance.upsert({
          where: {
            tenantId_staffId_attendanceDate: {
              tenantId,
              staffId: leave.staffId,
              attendanceDate,
            },
          },
          create: {
            tenantId,
            staffId: leave.staffId,
            attendanceDate,
            status: StaffAttendanceStatus.ABSENT,
            note,
            markedById: userId,
          },
          update: {
            status: StaffAttendanceStatus.ABSENT,
            note,
            inTime: null,
            outTime: null,
            markedById: userId,
          },
        }),
      ),
    );
  }

  return updated;
}

export async function addStaffAdjustment(
  tenantId: string,
  staffId: string,
  input: {
    name: string;
    type: AdjustmentType;
    amount: number;
    isRecurring?: boolean;
  },
) {
  await requireStaff(tenantId, staffId);
  return prisma.staffAdjustment.create({
    data: { tenantId, staffId, ...input },
  });
}

export async function updateStaffAdjustment(
  tenantId: string,
  adjustmentId: string,
  input: {
    name?: string;
    type?: AdjustmentType;
    amount?: number;
    isRecurring?: boolean;
    isActive?: boolean;
  },
) {
  const found = await prisma.staffAdjustment.findFirst({
    where: tenantScope(tenantId, { id: adjustmentId }),
  });
  if (!found) throw new AppError(404, "Adjustment not found", "ADJUSTMENT_NOT_FOUND");
  return prisma.staffAdjustment.update({
    where: { id: adjustmentId },
    data: input,
  });
}

export async function deleteStaffAdjustment(tenantId: string, adjustmentId: string) {
  const found = await prisma.staffAdjustment.findFirst({
    where: tenantScope(tenantId, { id: adjustmentId }),
  });
  if (!found) throw new AppError(404, "Adjustment not found", "ADJUSTMENT_NOT_FOUND");
  await prisma.staffAdjustment.delete({ where: { id: adjustmentId } });
}

export async function getStaffDetail(tenantId: string, staffId: string) {
  const staff = await prisma.staffProfile.findFirst({
    where: tenantScope(tenantId, { id: staffId }),
    include: {
      user: { include: { roles: { include: { role: true } } } },
      department: true,
      designation: true,
      adjustments: { orderBy: { createdAt: "desc" } },
      attendance: { orderBy: { attendanceDate: "desc" }, take: 120 },
      leaves: {
        include: { leaveType: true, reviewedBy: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      payrolls: {
        include: { items: true, academicSession: true },
        orderBy: { payrollMonth: "desc" },
        take: 24,
      },
      ratings: { orderBy: { ratingDate: "desc" }, take: 20 },
    },
  });
  if (!staff) throw new AppError(404, "Staff member not found", "STAFF_NOT_FOUND");
  return staff;
}

export async function deleteStaffProfile(tenantId: string, staffId: string) {
  const staff = await requireStaff(tenantId, staffId);
  if (staff.status !== StaffStatus.DISABLED) {
    throw new AppError(400, "Disable staff before deleting", "STAFF_NOT_DISABLED");
  }
  const paidPayroll = await prisma.payroll.count({
    where: tenantScope(tenantId, { staffId, status: PayrollStatus.PAID }),
  });
  if (paidPayroll > 0) {
    throw new AppError(409, "Cannot delete staff with paid payroll history", "STAFF_HAS_PAYROLL");
  }
  await prisma.$transaction(async (tx) => {
    await tx.payroll.deleteMany({ where: { tenantId, staffId } });
    await tx.staffAttendance.deleteMany({ where: { tenantId, staffId } });
    await tx.staffLeave.deleteMany({ where: { tenantId, staffId } });
    await tx.staffAdjustment.deleteMany({ where: { tenantId, staffId } });
    await tx.teacherRating.deleteMany({ where: { tenantId, staffId } });
    await tx.staffProfile.delete({ where: { id: staffId } });
  });
}

export async function getPayrollPayslip(tenantId: string, payrollId: string) {
  const payroll = await prisma.payroll.findFirst({
    where: tenantScope(tenantId, { id: payrollId }),
    include: {
      items: true,
      academicSession: true,
      staff: {
        include: { user: true, department: true, designation: true },
      },
      tenant: { select: { name: true, branding: true } },
    },
  });
  if (!payroll) throw new AppError(404, "Payroll not found", "PAYROLL_NOT_FOUND");
  const monthStart = payroll.payrollMonth;
  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  );
  const attendance = await prisma.staffAttendance.findMany({
    where: tenantScope(tenantId, {
      staffId: payroll.staffId,
      attendanceDate: { gte: monthStart, lte: monthEnd },
    }),
    orderBy: { attendanceDate: "asc" },
  });
  const leaves = await prisma.staffLeave.findMany({
    where: tenantScope(tenantId, {
      staffId: payroll.staffId,
      status: StaffLeaveStatus.APPROVED,
      fromDate: { lte: monthEnd },
      toDate: { gte: monthStart },
    }),
    include: { leaveType: true },
  });
  return { payroll, attendance, leaves };
}

export async function listDisabledStaff(tenantId: string) {
  return prisma.staffProfile.findMany({
    where: tenantScope(tenantId, { status: StaffStatus.DISABLED }),
    include: { user: true, department: true, designation: true },
    orderBy: { employeeNumber: "asc" },
  });
}

export async function applyOwnStaffLeave(
  tenantId: string,
  userId: string,
  input: {
    leaveTypeId: string;
    fromDate: Date;
    toDate: Date;
    reason: string;
    attachment?: { name: string; dataUrl: string } | null;
  },
) {
  const staff = await prisma.staffProfile.findFirst({
    where: tenantScope(tenantId, { userId, status: StaffStatus.ACTIVE }),
  });
  if (!staff) throw new AppError(404, "Staff profile not found for this user", "STAFF_NOT_FOUND");
  return applyStaffLeave(tenantId, { ...input, staffId: staff.id });
}

export async function generatePayroll(
  tenantId: string,
  input: {
    academicSessionId: string;
    payrollMonth: Date;
    staffIds?: string[];
  },
) {
  const { start, end } = monthBounds(input.payrollMonth);
  const session = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { id: input.academicSessionId }),
  });
  if (!session) throw new AppError(400, "Academic session is invalid", "INVALID_SESSION");
  const staff = await prisma.staffProfile.findMany({
    where: tenantScope(tenantId, {
      status: StaffStatus.ACTIVE,
      ...(input.staffIds?.length ? { id: { in: input.staffIds } } : {}),
    }),
    include: {
      attendance: { where: { attendanceDate: { gte: start, lte: end } } },
      adjustments: { where: { isActive: true } },
    },
  });
  if (input.staffIds?.length && staff.length !== new Set(input.staffIds).size) {
    throw new AppError(400, "One or more active staff records are invalid", "INVALID_STAFF");
  }
  for (const member of staff) {
    const existing = await prisma.payroll.findFirst({
      where: tenantScope(tenantId, { staffId: member.id, payrollMonth: start }),
    });
    if (existing?.status === PayrollStatus.PAID) continue;
    const absenceUnits = member.attendance.reduce((units, record) => {
      if (record.status === StaffAttendanceStatus.ABSENT) return units + 1;
      if (record.status === StaffAttendanceStatus.HALF_DAY) return units + 0.5;
      return units;
    }, 0);
    const basicSalary = Number(member.basicSalary);
    const perDay =
      member.absenceDeduction != null
        ? Number(member.absenceDeduction)
        : basicSalary / 30;
    const attendanceDeduction = Number((perDay * absenceUnits).toFixed(2));
    const earnings = member.adjustments
      .filter((item) => item.type === AdjustmentType.EARNING)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const deductions = member.adjustments
      .filter((item) => item.type === AdjustmentType.DEDUCTION)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const grossAmount = basicSalary + earnings;
    const netAmount = Math.max(0, grossAmount - deductions - attendanceDeduction);
    await prisma.$transaction(async (tx) => {
      const payroll = await tx.payroll.upsert({
        where: {
          tenantId_staffId_payrollMonth: {
            tenantId,
            staffId: member.id,
            payrollMonth: start,
          },
        },
        create: {
          tenantId,
          staffId: member.id,
          academicSessionId: input.academicSessionId,
          payrollMonth: start,
          basicSalary,
          attendanceDeduction,
          grossAmount,
          netAmount,
          status: PayrollStatus.GENERATED,
        },
        update: {
          academicSessionId: input.academicSessionId,
          basicSalary,
          attendanceDeduction,
          grossAmount,
          netAmount,
          status: PayrollStatus.GENERATED,
        },
      });
      await tx.payrollItem.deleteMany({ where: { payrollId: payroll.id } });
      if (member.adjustments.length) {
        await tx.payrollItem.createMany({
          data: member.adjustments.map((item) => ({
            tenantId,
            payrollId: payroll.id,
            name: item.name,
            type: item.type,
            amount: item.amount,
          })),
        });
      }
    });
  }
  return prisma.payroll.findMany({
    where: tenantScope(tenantId, { payrollMonth: start }),
    include: { staff: { include: { user: true } }, items: true },
  });
}

export async function payPayroll(
  tenantId: string,
  payrollId: string,
  input: { paymentMode: PaymentMode; note?: string | null },
) {
  const payroll = await prisma.payroll.findFirst({
    where: tenantScope(tenantId, { id: payrollId }),
  });
  if (!payroll) throw new AppError(404, "Payroll not found", "PAYROLL_NOT_FOUND");
  if (payroll.status === PayrollStatus.PAID) {
    throw new AppError(409, "Payroll is already paid", "PAYROLL_ALREADY_PAID");
  }
  return prisma.payroll.update({
    where: { id: payrollId },
    data: {
      status: PayrollStatus.PAID,
      paidAt: new Date(),
      paymentMode: input.paymentMode,
      note: input.note,
    },
    include: { staff: { include: { user: true } }, items: true },
  });
}

export async function revertPayroll(tenantId: string, payrollId: string) {
  const payroll = await prisma.payroll.findFirst({
    where: tenantScope(tenantId, { id: payrollId }),
  });
  if (!payroll) throw new AppError(404, "Payroll not found", "PAYROLL_NOT_FOUND");
  if (payroll.status === PayrollStatus.PAID) {
    // Paid -> back to Generated (payment details cleared)
    return prisma.payroll.update({
      where: { id: payrollId },
      data: { status: PayrollStatus.GENERATED, paidAt: null, paymentMode: null, note: null },
      include: { staff: { include: { user: true } }, items: true },
    });
  }
  // Generated -> back to Not Generated (record removed)
  await prisma.payroll.delete({ where: { id: payrollId } });
  return null;
}

export async function addTeacherRating(
  tenantId: string,
  ratedById: string,
  input: { staffId: string; rating: number; comment?: string | null; ratingDate: Date },
) {
  const staff = await requireStaff(tenantId, input.staffId);
  const isTeacher = await prisma.userRole.findFirst({
    where: {
      tenantId,
      userId: staff.userId,
      role: { code: "TEACHER" },
    },
  });
  if (!isTeacher) throw new AppError(400, "Ratings can only be added for teachers", "NOT_A_TEACHER");
  return prisma.teacherRating.create({
    data: { tenantId, ratedById, ...input },
    include: { staff: { include: { user: true } }, ratedBy: true },
  });
}

const TREND_PERIOD_MS = 90 * 86_400_000;

export async function getTeacherRatingsSummary(tenantId: string) {
  const [staff, classSubjects] = await Promise.all([
    prisma.staffProfile.findMany({
      where: tenantScope(tenantId, { status: StaffStatus.ACTIVE }),
      include: {
        user: true,
        designation: true,
        ratings: { orderBy: { ratingDate: "desc" } },
      },
      orderBy: { employeeNumber: "asc" },
    }),
    prisma.classSubject.findMany({
      where: tenantScope(tenantId, { teacherId: { not: null } }),
      include: {
        subject: true,
        classSection: { include: { academicClass: true, section: true } },
      },
    }),
  ]);

  const teachingByUser = new Map<string, { subjects: Set<string>; classes: Set<string> }>();
  for (const item of classSubjects) {
    if (!item.teacherId) continue;
    const entry =
      teachingByUser.get(item.teacherId) ?? { subjects: new Set(), classes: new Set() };
    entry.subjects.add(item.subject.name);
    entry.classes.add(
      `${item.classSection.academicClass.name} - ${item.classSection.section.name}`,
    );
    teachingByUser.set(item.teacherId, entry);
  }

  const now = Date.now();
  return staff.flatMap((member) => {
    const teaching = teachingByUser.get(member.userId);
    const total = member.ratings.length;
    if (!teaching && !total) return [];
    const average = total
      ? member.ratings.reduce((sum, item) => sum + item.rating, 0) / total
      : 0;
    const recentWindow = member.ratings.filter(
      (item) => now - item.ratingDate.getTime() <= TREND_PERIOD_MS,
    );
    const priorWindow = member.ratings.filter((item) => {
      const age = now - item.ratingDate.getTime();
      return age > TREND_PERIOD_MS && age <= 2 * TREND_PERIOD_MS;
    });
    let trend: number | null = null;
    if (recentWindow.length && priorWindow.length) {
      const recentAvg =
        recentWindow.reduce((sum, item) => sum + item.rating, 0) / recentWindow.length;
      const priorAvg =
        priorWindow.reduce((sum, item) => sum + item.rating, 0) / priorWindow.length;
      if (priorAvg > 0) trend = Math.round(((recentAvg - priorAvg) / priorAvg) * 100);
    }
    return [
      {
        staffId: member.id,
        name: `${member.user.firstName} ${member.user.lastName}`.trim(),
        designation: member.designation?.name ?? null,
        photoUrl: member.photoUrl ?? member.user.avatarUrl,
        subjects: [...(teaching?.subjects ?? [])].sort(),
        classes: [...(teaching?.classes ?? [])].sort(),
        averageRating: Number(average.toFixed(1)),
        totalReviews: total,
        trend,
        recent: member.ratings.slice(0, 5).map((item) => ({
          id: item.id,
          rating: item.rating,
          comment: item.comment,
          ratingDate: item.ratingDate,
        })),
      },
    ];
  });
}
