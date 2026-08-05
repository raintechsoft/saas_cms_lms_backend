import {
  AttendanceStatus,
  EnrollmentStatus,
  ExamStatus,
  FeeAssignmentStatus,
  FeeFineType,
  DiscountType,
  PaymentStatus,
  Prisma,
  StaffLeaveStatus,
  StaffStatus,
  StudentStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getExamResults } from "../exams/exams.service.js";
import { getHomeworkReport, HOMEWORK_REPORTS } from "../homework/homework.service.js";
import { FEE_REPORTS } from "./fee-reports.service.js";
import { STUDENT_REPORTS } from "./student-reports.service.js";
import { ATTENDANCE_REPORTS } from "../attendance/attendance-extensions.service.js";
import {
  getExamReports,
  getExtraReportsCatalog,
  getHrReports,
  getOpsReports,
  getUnavailableReports,
} from "./extended-reports.service.js";

export type ReportModule =
  | "students"
  | "finance"
  | "attendance"
  | "examinations"
  | "timetable"
  | "homework"
  | "hr"
  | "audit";

export type CoreReportKey =
  | "active_students"
  | "due_fees"
  | "fee_collection"
  | "daily_attendance"
  | "attendance_summary"
  | "exam_rank";

export const CORE_REPORTS: Array<{
  key: CoreReportKey;
  label: string;
  description: string;
  bucket: "SHARED" | "CMS";
  needsExam?: boolean;
}> = [
  {
    key: "active_students",
    label: "Active Students",
    description: "Active students with current class/section",
    bucket: "SHARED",
  },
  {
    key: "due_fees",
    label: "Due Fees",
    description: "Students with outstanding fee balances",
    bucket: "CMS",
  },
  {
    key: "fee_collection",
    label: "Fee Collection",
    description: "Collected fee payments in selected date range",
    bucket: "CMS",
  },
  {
    key: "daily_attendance",
    label: "Daily Attendance",
    description: "Attendance records for a selected date/range",
    bucket: "SHARED",
  },
  {
    key: "attendance_summary",
    label: "Attendance Summary",
    description: "Per-student attendance totals and percentage",
    bucket: "SHARED",
  },
  {
    key: "exam_rank",
    label: "Exam Rank / Result",
    description: "Ranked exam results for a selected exam",
    bucket: "SHARED",
    needsExam: true,
  },
];

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function calculateDiscount(
  type: DiscountType | undefined,
  value: Prisma.Decimal | undefined,
  base: number,
) {
  if (!type || !value) return 0;
  const discount =
    type === DiscountType.PERCENTAGE ? (base * money(value)) / 100 : money(value);
  return Math.min(base, Math.max(0, discount));
}

function calculateFine(
  fineType: FeeFineType,
  fineValue: Prisma.Decimal,
  base: number,
  dueDate: Date,
  graceDays: number,
  asOf: Date,
  ranges: Array<{
    startDate: Date;
    endDate: Date | null;
    amount: Prisma.Decimal;
    perDay: boolean;
  }> = [],
) {
  const effectiveDue = new Date(dueDate);
  effectiveDue.setUTCDate(effectiveDue.getUTCDate() + graceDays);
  if (fineType === FeeFineType.NONE || asOf <= effectiveDue) return 0;
  if (fineType === FeeFineType.PERCENTAGE) return (base * money(fineValue)) / 100;
  if (fineType === FeeFineType.PER_DAY) {
    const days = Math.max(
      1,
      Math.ceil((asOf.getTime() - effectiveDue.getTime()) / 86_400_000),
    );
    return days * money(fineValue);
  }
  if (fineType === FeeFineType.DATE_RANGE) {
    const range = ranges.find(
      (item) => asOf >= item.startDate && (!item.endDate || asOf <= item.endDate),
    );
    if (!range) return 0;
    if (!range.perDay) return money(range.amount);
    const days = Math.max(
      1,
      Math.ceil((asOf.getTime() - range.startDate.getTime()) / 86_400_000) + 1,
    );
    return days * money(range.amount);
  }
  return money(fineValue);
}

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
    examOptions,
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
    prisma.exam.findMany({
      where: tenantScope(tenantId, {
        ...(currentSession ? { examGroup: { academicSessionId: currentSession.id } } : {}),
      }),
      select: {
        id: true,
        name: true,
        status: true,
        examGroup: { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
      take: 50,
    }),
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
  const coreReports = CORE_REPORTS.filter((item) => {
    if (item.bucket === "CMS" && productMode === "LMS") return false;
    return true;
  });
  return {
    currentSession,
    exams: examOptions,
    coreReports,
    studentReports: productMode === "LMS" ? [] : STUDENT_REPORTS,
    feeReports: productMode === "LMS" ? [] : FEE_REPORTS,
    homeworkReports: HOMEWORK_REPORTS,
    attendanceReports: ATTENDANCE_REPORTS,
    hrReports: productMode === "LMS" ? [] : getHrReports(),
    examReports: getExamReports(),
    opsReports: getOpsReports(),
    extraReports: getExtraReportsCatalog(),
    unavailableReports: getUnavailableReports(),
    modules: modules.filter(({ key }) => {
      if (productMode === "LMS") return !["finance", "hr"].includes(key);
      if (productMode === "CMS") return !["timetable"].includes(key);
      return true;
    }),
  };
}

export async function runCoreReport(
  tenantId: string,
  reportKey: CoreReportKey,
  query: {
    sessionId?: string;
    from?: Date;
    to?: Date;
    examId?: string;
    classSectionId?: string;
  },
) {
  if (query.from && query.to && query.to < query.from) {
    throw new AppError(400, "Invalid report date range", "INVALID_DATE_RANGE");
  }

  const session =
    query.sessionId
      ? await prisma.academicSession.findFirst({
          where: tenantScope(tenantId, { id: query.sessionId }),
          select: { id: true, name: true },
        })
      : await prisma.academicSession.findFirst({
          where: tenantScope(tenantId, { isCurrent: true }),
          select: { id: true, name: true },
        });

  if (reportKey === "active_students") {
    const students = await prisma.student.findMany({
      where: tenantScope(tenantId, {
        status: StudentStatus.ACTIVE,
        ...(query.classSectionId || session
          ? {
              enrollments: {
                some: {
                  status: EnrollmentStatus.ACTIVE,
                  ...(session ? { academicSessionId: session.id } : {}),
                  ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
                },
              },
            }
          : {}),
      }),
      include: {
        category: true,
        house: true,
        enrollments: {
          where: {
            status: EnrollmentStatus.ACTIVE,
            ...(session ? { academicSessionId: session.id } : {}),
          },
          include: {
            academicSession: true,
            classSection: { include: { academicClass: true, section: true } },
          },
          orderBy: { enrolledAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    return {
      reportKey,
      title: "Active Students Report",
      session,
      summary: { total: students.length },
      rows: students.map((student) => {
        const enrollment = student.enrollments[0];
        return {
          id: student.id,
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName ?? ""}`.trim(),
          mobile: student.mobile,
          email: student.email,
          category: student.category?.name ?? null,
          house: student.house?.name ?? null,
          classSection: enrollment
            ? `${enrollment.classSection.academicClass.name} · ${enrollment.classSection.section.name}`
            : "—",
          sessionName: enrollment?.academicSession.name ?? session?.name ?? "—",
        };
      }),
    };
  }

  if (reportKey === "due_fees") {
    if (!session) throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    const asOf = query.to ?? new Date();
    const assignments = await prisma.studentFeeAssignment.findMany({
      where: tenantScope(tenantId, {
        status: FeeAssignmentStatus.ACTIVE,
        studentEnrollment: {
          academicSessionId: session.id,
          status: EnrollmentStatus.ACTIVE,
          ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
          student: { status: StudentStatus.ACTIVE },
        },
      }),
      include: {
        feeMaster: {
          include: {
            feeType: true,
            fineRanges: { orderBy: { startDate: "asc" } },
          },
        },
        discount: true,
        paymentItems: {
          where: { payment: { status: PaymentStatus.COLLECTED } },
          include: { payment: true },
        },
        studentEnrollment: {
          include: {
            student: true,
            classSection: { include: { academicClass: true, section: true } },
          },
        },
      },
    });

    const byStudent = new Map<
      string,
      {
        studentId: string;
        admissionNumber: string;
        name: string;
        classSection: string;
        balance: number;
        items: Array<{ feeType: string; dueDate: string; balance: number }>;
      }
    >();

    for (const assignment of assignments) {
      const base =
        money(assignment.customAmount ?? assignment.feeMaster.amount) +
        money(assignment.carryForwardAmount);
      const discount = calculateDiscount(
        assignment.discount?.type,
        assignment.discount?.value,
        base,
      );
      const fine = calculateFine(
        assignment.feeMaster.fineType,
        assignment.feeMaster.fineValue,
        base,
        assignment.feeMaster.dueDate,
        assignment.feeMaster.graceDays,
        asOf,
        assignment.feeMaster.fineRanges,
      );
      const paid = assignment.paymentItems.reduce(
        (sum, item) => sum + money(item.paidAmount),
        0,
      );
      const balance = Math.max(0, base - discount + fine - paid);
      if (balance < 0.01) continue;

      const student = assignment.studentEnrollment.student;
      const key = student.id;
      const existing = byStudent.get(key);
      const classSection = `${assignment.studentEnrollment.classSection.academicClass.name} · ${assignment.studentEnrollment.classSection.section.name}`;
      const item = {
        feeType: assignment.feeMaster.feeType.name,
        dueDate: assignment.feeMaster.dueDate.toISOString().slice(0, 10),
        balance: Number(balance.toFixed(2)),
      };
      if (existing) {
        existing.balance += balance;
        existing.items.push(item);
      } else {
        byStudent.set(key, {
          studentId: student.id,
          admissionNumber: student.admissionNumber,
          name: `${student.firstName} ${student.lastName ?? ""}`.trim(),
          classSection,
          balance,
          items: [item],
        });
      }
    }

    const rows = [...byStudent.values()]
      .map((row) => ({
        studentId: row.studentId,
        admissionNumber: row.admissionNumber,
        name: row.name,
        classSection: row.classSection,
        dueHeads: row.items.length,
        balance: Number(row.balance.toFixed(2)),
      }))
      .sort((a, b) => b.balance - a.balance);
    const totalDue = rows.reduce((sum, row) => sum + row.balance, 0);
    return {
      reportKey,
      title: "Due Fees Report",
      session,
      summary: { students: rows.length, totalDue: Number(totalDue.toFixed(2)) },
      rows,
    };
  }

  if (reportKey === "fee_collection") {
    if (!session) throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    const payments = await prisma.feePayment.findMany({
      where: tenantScope(tenantId, {
        academicSessionId: session.id,
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
      include: {
        student: true,
        items: { include: { assignment: { include: { feeMaster: { include: { feeType: true } } } } } },
      },
      orderBy: { paymentDate: "desc" },
    });
    const collected = payments.reduce((sum, payment) => sum + money(payment.amount), 0);
    const byMode = payments.reduce<Record<string, number>>((acc, payment) => {
      acc[payment.paymentMode] = (acc[payment.paymentMode] ?? 0) + money(payment.amount);
      return acc;
    }, {});
    return {
      reportKey,
      title: "Fee Collection Report",
      session,
      summary: {
        payments: payments.length,
        collected: Number(collected.toFixed(2)),
        byMode,
      },
      rows: payments.map((payment) => ({
        id: payment.id,
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
        amount: Number(money(payment.amount).toFixed(2)),
        paymentMode: payment.paymentMode,
        studentName: `${payment.student.firstName} ${payment.student.lastName ?? ""}`.trim(),
        admissionNumber: payment.student.admissionNumber,
        feeTypes: payment.items
          .map((item) => item.assignment.feeMaster.feeType.name)
          .join(", "),
      })),
    };
  }

  if (reportKey === "daily_attendance") {
    const from = query.from ?? query.to ?? new Date();
    const to = query.to ?? query.from ?? from;
    const dayStart = new Date(from);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(to);
    dayEnd.setHours(23, 59, 59, 999);

    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        ...(session ? { academicSessionId: session.id } : {}),
        attendanceDate: { gte: dayStart, lte: dayEnd },
        ...(query.classSectionId
          ? { studentEnrollment: { classSectionId: query.classSectionId } }
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
      orderBy: [{ attendanceDate: "asc" }, { studentEnrollment: { student: { firstName: "asc" } } }],
    });
    const summary = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.status] = (acc[record.status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      reportKey,
      title: "Daily Attendance Report",
      session,
      summary: { total: records.length, ...summary },
      rows: records.map((record) => ({
        id: record.id,
        date: record.attendanceDate.toISOString().slice(0, 10),
        status: record.status,
        periodKey: record.periodKey,
        studentName: `${record.studentEnrollment.student.firstName} ${record.studentEnrollment.student.lastName ?? ""}`.trim(),
        admissionNumber: record.studentEnrollment.student.admissionNumber,
        classSection: `${record.studentEnrollment.classSection.academicClass.name} · ${record.studentEnrollment.classSection.section.name}`,
      })),
    };
  }

  if (reportKey === "attendance_summary") {
    if (!session) throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        academicSessionId: session.id,
        ...(query.from || query.to
          ? {
              attendanceDate: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
        ...(query.classSectionId
          ? { studentEnrollment: { classSectionId: query.classSectionId } }
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
    });

    const byEnrollment = new Map<
      string,
      {
        studentName: string;
        admissionNumber: string;
        classSection: string;
        present: number;
        late: number;
        absent: number;
        halfDay: number;
        holiday: number;
        total: number;
      }
    >();

    for (const record of records) {
      const key = record.studentEnrollmentId;
      const existing = byEnrollment.get(key) ?? {
        studentName: `${record.studentEnrollment.student.firstName} ${record.studentEnrollment.student.lastName ?? ""}`.trim(),
        admissionNumber: record.studentEnrollment.student.admissionNumber,
        classSection: `${record.studentEnrollment.classSection.academicClass.name} · ${record.studentEnrollment.classSection.section.name}`,
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        holiday: 0,
        total: 0,
      };
      existing.total += 1;
      if (record.status === AttendanceStatus.PRESENT) existing.present += 1;
      else if (record.status === AttendanceStatus.LATE) existing.late += 1;
      else if (record.status === AttendanceStatus.ABSENT) existing.absent += 1;
      else if (record.status === AttendanceStatus.HALF_DAY) existing.halfDay += 1;
      else if (record.status === AttendanceStatus.HOLIDAY) existing.holiday += 1;
      byEnrollment.set(key, existing);
    }

    const rows = [...byEnrollment.values()]
      .map((row) => {
        const countedDays = Math.max(0, row.total - row.holiday);
        const attended = row.present + row.late + row.halfDay * 0.5;
        const percentage = countedDays ? Number(((attended / countedDays) * 100).toFixed(1)) : 0;
        return { ...row, percentage };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    return {
      reportKey,
      title: "Attendance Summary Report",
      session,
      summary: { students: rows.length },
      rows,
    };
  }

  if (reportKey === "exam_rank") {
    if (!query.examId) throw new AppError(400, "Exam is required", "EXAM_REQUIRED");
    const result = await getExamResults(tenantId, query.examId);
    return {
      reportKey,
      title: "Exam Rank / Result Report",
      session,
      exam: {
        id: result.exam.id,
        name: result.exam.name,
        status: result.exam.status,
      },
      summary: {
        students: result.results.length,
        published: result.published,
      },
      rows: result.results.map((row) => ({
        rank: row.rank,
        admissionNumber: row.student.admissionNumber,
        studentName: `${row.student.firstName} ${row.student.lastName ?? ""}`.trim(),
        classSection: `${row.classSection.academicClass.name} · ${row.classSection.section.name}`,
        obtainedMarks: row.obtainedMarks,
        maximumMarks: row.maximumMarks,
        percentage: row.percentage,
        grade: row.grade,
        passStatus: row.passStatus,
      })),
    };
  }

  throw new AppError(404, "Core report not found", "CORE_REPORT_NOT_FOUND");
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
