import {
  AdjustmentType,
  PayrollStatus,
  StaffAttendanceStatus,
  StaffLeaveStatus,
  StaffStatus,
  UserStatus,
  type PaymentMode,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

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
  const [departments, designations, leaveTypes, staff, pendingLeaves, payrolls] =
    await Promise.all([
      prisma.department.findMany({ where: tenantScope(tenantId, {}), orderBy: { name: "asc" } }),
      prisma.designation.findMany({ where: tenantScope(tenantId, {}), orderBy: { name: "asc" } }),
      prisma.staffLeaveType.findMany({ where: tenantScope(tenantId, {}), orderBy: { name: "asc" } }),
      prisma.staffProfile.findMany({
        where: tenantScope(tenantId, {}),
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          department: true,
          designation: true,
          attendance: { where: { attendanceDate: { gte: start, lte: end } } },
          _count: { select: { leaves: true, ratings: true } },
        },
        orderBy: { employeeNumber: "asc" },
      }),
      prisma.staffLeave.findMany({
        where: tenantScope(tenantId, { status: StaffLeaveStatus.PENDING }),
        include: { staff: { include: { user: true } }, leaveType: true },
        orderBy: { createdAt: "asc" },
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
    staff,
    pendingLeaves,
    payrolls,
  };
}

export async function createDepartment(tenantId: string, name: string) {
  return prisma.department.create({ data: { tenantId, name } });
}

export async function createDesignation(tenantId: string, name: string) {
  return prisma.designation.create({ data: { tenantId, name } });
}

export async function createStaffLeaveType(
  tenantId: string,
  input: { name: string; annualLimit?: number | null },
) {
  return prisma.staffLeaveType.create({ data: { tenantId, ...input } });
}

export async function createStaffProfile(
  tenantId: string,
  input: {
    userId: string;
    employeeNumber?: string;
    departmentId?: string | null;
    designationId?: string | null;
    joiningDate: Date;
    dateOfBirth?: Date | null;
    phone?: string | null;
    address?: string | null;
    basicSalary: number;
  },
) {
  const user = await prisma.user.findFirst({
    where: tenantScope(tenantId, { id: input.userId, status: UserStatus.ACTIVE }),
    include: { roles: { include: { role: true } } },
  });
  if (!user) throw new AppError(400, "Tenant user is invalid", "INVALID_USER");
  const staffRoleCodes = new Set([
    "INSTITUTION_ADMIN",
    "TEACHER",
    "ACCOUNTANT",
    "STAFF",
  ]);
  if (!user.roles.some(({ role }) => staffRoleCodes.has(role.code))) {
    throw new AppError(
      400,
      "User must have an institution staff role",
      "INVALID_STAFF_ROLE",
    );
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
  return prisma.$transaction(async (tx) => {
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
      employeeNumber = `${setting.staffPrefix ?? "STF-"}${updated.nextStaffNumber - 1}`;
    }
    const { employeeNumber: _ignored, ...data } = input;
    return tx.staffProfile.create({
      data: { tenantId, ...data, employeeNumber },
      include: { user: true, department: true, designation: true },
    });
  });
}

export async function updateStaffStatus(
  tenantId: string,
  staffId: string,
  input: { status: StaffStatus; disabledReason?: string | null },
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
  },
) {
  if (input.toDate < input.fromDate) {
    throw new AppError(400, "Invalid leave date range", "INVALID_DATE_RANGE");
  }
  await requireStaff(tenantId, input.staffId);
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
  return prisma.staffLeave.create({
    data: { tenantId, ...input },
    include: { staff: { include: { user: true } }, leaveType: true },
  });
}

export async function reviewStaffLeave(
  tenantId: string,
  userId: string,
  leaveId: string,
  input: { status: StaffLeaveStatus; reviewNote?: string | null },
) {
  if (input.status === StaffLeaveStatus.PENDING) {
    throw new AppError(400, "Review must approve or reject leave", "INVALID_REVIEW_STATUS");
  }
  const leave = await prisma.staffLeave.findFirst({
    where: tenantScope(tenantId, { id: leaveId, status: StaffLeaveStatus.PENDING }),
  });
  if (!leave) throw new AppError(404, "Pending leave request not found", "LEAVE_NOT_FOUND");
  return prisma.staffLeave.update({
    where: { id: leaveId },
    data: {
      ...input,
      reviewedById: userId,
      reviewedAt: new Date(),
    },
    include: { staff: { include: { user: true } }, leaveType: true },
  });
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
    const attendanceDeduction = Number(((basicSalary / 30) * absenceUnits).toFixed(2));
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
