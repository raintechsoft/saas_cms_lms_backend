import {
  EnrollmentStatus,
  ExamStatus,
  FeeAssignmentStatus,
  PaymentStatus,
  StaffLeaveStatus,
  StaffStatus,
  StudentStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getExamResults } from "../exams/exams.service.js";
import { getHomeworkReport } from "../homework/homework.service.js";

export type ReportModule =
  | "students"
  | "finance"
  | "attendance"
  | "examinations"
  | "timetable"
  | "homework"
  | "hr"
  | "audit";

export async function getReportHub(
  tenantId: string,
  productMode: "CMS" | "LMS" | "BOTH" | null,
) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  const [
    students,
    disabledStudents,
    staff,
    disabledStaff,
    exams,
    publishedExams,
    pendingLeaves,
    generatedDocuments,
    timetablePeriods,
    homework,
  ] = await Promise.all([
    prisma.student.count({ where: tenantScope(tenantId, {}) }),
    prisma.student.count({
      where: tenantScope(tenantId, { status: StudentStatus.DISABLED }),
    }),
    prisma.staffProfile.count({ where: tenantScope(tenantId, {}) }),
    prisma.staffProfile.count({
      where: tenantScope(tenantId, { status: StaffStatus.DISABLED }),
    }),
    prisma.exam.count({ where: tenantScope(tenantId, {}) }),
    prisma.exam.count({
      where: tenantScope(tenantId, { status: ExamStatus.PUBLISHED }),
    }),
    prisma.staffLeave.count({
      where: tenantScope(tenantId, { status: StaffLeaveStatus.PENDING }),
    }),
    prisma.generatedDocument.count({ where: tenantScope(tenantId, {}) }),
    prisma.timetableEntry.count({ where: tenantScope(tenantId, {}) }),
    prisma.homework.count({ where: tenantScope(tenantId, {}) }),
  ]);
  const modules = [
    {
      key: "students",
      label: "Student Management",
      metrics: { total: students, disabled: disabledStudents },
    },
    { key: "finance", label: "Finance", metrics: { session: currentSession?.name ?? null } },
    { key: "attendance", label: "Attendance", metrics: { session: currentSession?.name ?? null } },
    {
      key: "examinations",
      label: "Examinations",
      metrics: { total: exams, published: publishedExams },
    },
    {
      key: "timetable",
      label: "Timetable",
      metrics: { periods: timetablePeriods },
    },
    {
      key: "homework",
      label: "Homework",
      metrics: { assignments: homework },
    },
    {
      key: "hr",
      label: "Human Resources",
      metrics: { total: staff, disabled: disabledStaff, pendingLeaves },
    },
    {
      key: "audit",
      label: "Audit Trail",
      metrics: { generatedDocuments },
    },
  ];
  return {
    currentSession,
    modules: modules.filter(({ key }) => {
      if (productMode === "LMS") return !["finance", "hr"].includes(key);
      if (productMode === "CMS") return !["timetable", "homework"].includes(key);
      return true;
    }),
  };
}

export async function runModuleReport(
  tenantId: string,
  module: ReportModule,
  query: {
    sessionId?: string;
    from?: Date;
    to?: Date;
    examId?: string;
    includeDisabled?: boolean;
  },
) {
  if (query.from && query.to && query.to < query.from) {
    throw new AppError(400, "Invalid report date range", "INVALID_DATE_RANGE");
  }
  if (module === "students") {
    return prisma.student.findMany({
      where: tenantScope(tenantId, {
        ...(query.includeDisabled ? {} : { status: { not: StudentStatus.DISABLED } }),
        enrollments: query.sessionId
          ? { some: { academicSessionId: query.sessionId } }
          : undefined,
      }),
      include: {
        category: true,
        house: true,
        enrollments: {
          where: query.sessionId ? { academicSessionId: query.sessionId } : undefined,
          include: {
            academicSession: true,
            classSection: { include: { academicClass: true, section: true } },
          },
          orderBy: { enrolledAt: "desc" },
        },
      },
      orderBy: [{ status: "asc" }, { firstName: "asc" }],
    });
  }

  if (module === "finance") {
    if (!query.sessionId) {
      throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    }
    const [payments, assignments] = await Promise.all([
      prisma.feePayment.findMany({
        where: tenantScope(tenantId, {
          academicSessionId: query.sessionId,
          status: PaymentStatus.COLLECTED,
          ...(query.from || query.to
            ? {
                paymentDate: {
                  ...(query.from ? { gte: query.from } : {}),
                  ...(query.to ? { lte: query.to } : {}),
                },
              }
            : {}),
        }),
        include: { student: true, items: true },
        orderBy: { paymentDate: "desc" },
      }),
      prisma.studentFeeAssignment.findMany({
        where: tenantScope(tenantId, {
          studentEnrollment: {
            academicSessionId: query.sessionId,
            status: EnrollmentStatus.ACTIVE,
          },
          status: FeeAssignmentStatus.ACTIVE,
        }),
        include: { feeMaster: true, discount: true, paymentItems: { include: { payment: true } } },
      }),
    ]);
    const collected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const assigned = assignments.reduce(
      (sum, item) => sum + Number(item.customAmount ?? item.feeMaster.amount) + Number(item.carryForwardAmount),
      0,
    );
    return {
      summary: { assigned, collected, outstanding: Math.max(0, assigned - collected) },
      payments,
    };
  }

  if (module === "attendance") {
    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        ...(query.sessionId ? { academicSessionId: query.sessionId } : {}),
        ...(query.from || query.to
          ? {
              attendanceDate: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
      }),
      include: {
        studentEnrollment: {
          include: {
            student: true,
            classSection: { include: { academicClass: true, section: true } },
          },
        },
      },
      orderBy: { attendanceDate: "desc" },
    });
    const summary = records.reduce<Record<string, number>>((result, record) => {
      result[record.status] = (result[record.status] ?? 0) + 1;
      return result;
    }, {});
    return { summary, records };
  }

  if (module === "examinations") {
    if (query.examId) return getExamResults(tenantId, query.examId);
    return prisma.exam.findMany({
      where: tenantScope(tenantId, {
        ...(query.sessionId ? { examGroup: { academicSessionId: query.sessionId } } : {}),
      }),
      include: {
        examGroup: { include: { academicSession: true } },
        _count: { select: { schedules: true, students: true } },
      },
      orderBy: { startDate: "desc" },
    });
  }

  if (module === "timetable") {
    if (!query.sessionId) {
      throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    }
    return prisma.timetableEntry.findMany({
      where: tenantScope(tenantId, { academicSessionId: query.sessionId }),
      include: {
        classSection: { include: { academicClass: true, section: true } },
        classSubject: { include: { subject: true } },
        teacher: true,
      },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    });
  }

  if (module === "homework") {
    if (!query.sessionId) {
      throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    }
    return getHomeworkReport(tenantId, { sessionId: query.sessionId });
  }

  if (module === "hr") {
    const [staff, payrolls, leaves, attendance] = await Promise.all([
      prisma.staffProfile.findMany({
        where: tenantScope(
          tenantId,
          query.includeDisabled ? {} : { status: StaffStatus.ACTIVE },
        ),
        include: { user: true, department: true, designation: true },
        orderBy: { employeeNumber: "asc" },
      }),
      prisma.payroll.findMany({
        where: tenantScope(tenantId, {
          ...(query.sessionId ? { academicSessionId: query.sessionId } : {}),
          ...(query.from || query.to
            ? {
                payrollMonth: {
                  ...(query.from ? { gte: query.from } : {}),
                  ...(query.to ? { lte: query.to } : {}),
                },
              }
            : {}),
        }),
        include: { staff: { include: { user: true } }, items: true },
      }),
      prisma.staffLeave.findMany({
        where: tenantScope(tenantId, {
          ...(query.from ? { toDate: { gte: query.from } } : {}),
          ...(query.to ? { fromDate: { lte: query.to } } : {}),
        }),
        include: { staff: { include: { user: true } }, leaveType: true },
      }),
      prisma.staffAttendance.findMany({
        where: tenantScope(tenantId, {
          ...(query.from || query.to
            ? {
                attendanceDate: {
                  ...(query.from ? { gte: query.from } : {}),
                  ...(query.to ? { lte: query.to } : {}),
                },
              }
            : {}),
        }),
        include: { staff: { include: { user: true } } },
      }),
    ]);
    const payrollSummary = payrolls.reduce(
      (summary, payroll) => {
        summary.gross += Number(payroll.grossAmount);
        summary.net += Number(payroll.netAmount);
        summary.deductions +=
          Number(payroll.attendanceDeduction) +
          payroll.items
            .filter((item) => item.type === "DEDUCTION")
            .reduce((sum, item) => sum + Number(item.amount), 0);
        return summary;
      },
      { gross: 0, net: 0, deductions: 0 },
    );
    return { summary: payrollSummary, staff, payrolls, leaves, attendance };
  }

  if (module === "audit") {
    const [auditLogs, documents] = await Promise.all([
      prisma.auditLog.findMany({
        where: tenantScope(tenantId, {
          ...(query.from || query.to
            ? {
                createdAt: {
                  ...(query.from ? { gte: query.from } : {}),
                  ...(query.to ? { lte: query.to } : {}),
                },
              }
            : {}),
        }),
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.generatedDocument.findMany({
        where: tenantScope(tenantId, {}),
        include: { template: true, generatedBy: true },
        orderBy: { generatedAt: "desc" },
        take: 500,
      }),
    ]);
    return { auditLogs, generatedDocuments: documents };
  }

  throw new AppError(404, "Report module not found", "REPORT_NOT_FOUND");
}
