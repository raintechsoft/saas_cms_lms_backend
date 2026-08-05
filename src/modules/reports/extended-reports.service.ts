import {
  EnrollmentStatus,
  ExamStatus,
  StaffStatus,
  StudentStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getExamGroupResults, getExamResults } from "../exams/exams.service.js";
import { runStudentReport } from "./student-reports.service.js";

export type ExtendedReportSection =
  | "hr"
  | "ops"
  | "exams"
  | "library"
  | "inventory"
  | "onlineExam"
  | "lessonPlan"
  | "alumni";

export type ExtendedReportKey =
  | "staff"
  | "payroll"
  | "staff_birthday"
  | "user_log"
  | "audit_trail"
  | "transport"
  | "hostel"
  | "alumni"
  | "exam_rank_session"
  | "exam_cumulative"
  | "book_issue"
  | "book_due"
  | "book_inventory"
  | "book_return"
  | "stock"
  | "add_item"
  | "issue_item"
  | "online_exam_wise"
  | "online_exams"
  | "online_attempt"
  | "online_rank"
  | "subjective_marks"
  | "syllabus_status"
  | "subject_lesson_plan";

const STUB_MESSAGE = "Module not enabled in this build";

const STUB_KEYS = new Set<ExtendedReportKey>([
  "book_issue",
  "book_due",
  "book_inventory",
  "book_return",
  "stock",
  "add_item",
  "issue_item",
  "online_exam_wise",
  "online_exams",
  "online_attempt",
  "online_rank",
  "subjective_marks",
  "syllabus_status",
  "subject_lesson_plan",
]);

export const EXTENDED_REPORT_SECTIONS: Array<{
  section: ExtendedReportSection;
  label: string;
}> = [
  { section: "hr", label: "Human Resources" },
  { section: "ops", label: "Operations" },
  { section: "exams", label: "Examinations" },
  { section: "alumni", label: "Alumni" },
  { section: "library", label: "Library" },
  { section: "inventory", label: "Inventory" },
  { section: "onlineExam", label: "Online Exam" },
  { section: "lessonPlan", label: "Lesson Plan" },
];

type ReportCatalogItem = {
  section: ExtendedReportSection;
  key: ExtendedReportKey;
  label: string;
  description: string;
  available: boolean;
};

const CATALOG: ReportCatalogItem[] = [
  { section: "hr", key: "staff", label: "Staff Roster", description: "Staff details roster", available: true },
  { section: "hr", key: "payroll", label: "Payroll Report", description: "Payroll rows for month/session", available: true },
  { section: "hr", key: "staff_birthday", label: "Staff Birthday Report", description: "Staff birthdays in range or by month", available: true },
  { section: "ops", key: "user_log", label: "User Login Activity", description: "Users with last login, email, roles and status", available: true },
  { section: "ops", key: "audit_trail", label: "Audit Trail", description: "Structured audit log entries", available: true },
  { section: "ops", key: "transport", label: "Transport Report", description: "Students with transport opt-in or route", available: true },
  { section: "ops", key: "hostel", label: "Hostel Report", description: "Students with hostel opt-in or room", available: true },
  { section: "alumni", key: "alumni", label: "Alumni Report", description: "Alumni student records", available: true },
  { section: "exams", key: "exam_rank_session", label: "Exam Rank (Session)", description: "Ranks per published exam in session", available: true },
  { section: "exams", key: "exam_cumulative", label: "Cumulative Exam Results", description: "Per-student totals across exams in session/group", available: true },
  { section: "library", key: "book_issue", label: "Book Issue Report", description: "Library book issues", available: false },
  { section: "library", key: "book_due", label: "Book Due Report", description: "Overdue library books", available: false },
  { section: "library", key: "book_inventory", label: "Book Inventory Report", description: "Library inventory", available: false },
  { section: "library", key: "book_return", label: "Book Return Report", description: "Returned library books", available: false },
  { section: "inventory", key: "stock", label: "Stock Report", description: "Inventory stock levels", available: false },
  { section: "inventory", key: "add_item", label: "Add Item Report", description: "Items added to inventory", available: false },
  { section: "inventory", key: "issue_item", label: "Issue Item Report", description: "Items issued from inventory", available: false },
  { section: "onlineExam", key: "online_exam_wise", label: "Online Exam Wise Report", description: "Online exam summary", available: false },
  { section: "onlineExam", key: "online_exams", label: "Online Exams Report", description: "All online exams", available: false },
  { section: "onlineExam", key: "online_attempt", label: "Online Attempt Report", description: "Student online exam attempts", available: false },
  { section: "onlineExam", key: "online_rank", label: "Online Rank Report", description: "Online exam ranks", available: false },
  { section: "onlineExam", key: "subjective_marks", label: "Subjective Marks Report", description: "Subjective exam marks", available: false },
  { section: "lessonPlan", key: "syllabus_status", label: "Syllabus Status Report", description: "Syllabus completion status", available: false },
  { section: "lessonPlan", key: "subject_lesson_plan", label: "Subject Lesson Plan Report", description: "Subject-wise lesson plans", available: false },
];

export function getExtraReportsCatalog() {
  return CATALOG;
}

export function getHrReports() {
  return CATALOG.filter((item) => item.section === "hr");
}

export function getOpsReports() {
  return CATALOG.filter((item) => item.section === "ops");
}

export function getExamReports() {
  return CATALOG.filter((item) => item.section === "exams");
}

export function getUnavailableReports() {
  return {
    library: CATALOG.filter((item) => item.section === "library"),
    inventory: CATALOG.filter((item) => item.section === "inventory"),
    onlineExam: CATALOG.filter((item) => item.section === "onlineExam"),
    lessonPlan: CATALOG.filter((item) => item.section === "lessonPlan"),
  };
}

function nameOf(firstName: string, lastName?: string | null) {
  return `${firstName} ${lastName ?? ""}`.trim();
}

function classSectionLabel(classSection: {
  academicClass: { name: string };
  section: { name: string };
}) {
  return `${classSection.academicClass.name} · ${classSection.section.name}`;
}

async function resolveSession(tenantId: string, sessionId?: string) {
  if (sessionId) {
    return prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: sessionId }),
      select: { id: true, name: true, startDate: true, endDate: true },
    });
  }
  return prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
    select: { id: true, name: true, startDate: true, endDate: true },
  });
}

function stubReport(reportKey: ExtendedReportKey) {
  const meta = CATALOG.find((item) => item.key === reportKey);
  return {
    reportKey,
    title: meta?.label ?? reportKey,
    session: null,
    summary: { available: false, message: STUB_MESSAGE },
    rows: [] as unknown[],
  };
}

export async function runExtendedReport(
  tenantId: string,
  reportKey: ExtendedReportKey,
  query: {
    section?: ExtendedReportSection;
    sessionId?: string;
    from?: Date;
    to?: Date;
    classSectionId?: string;
    examGroupId?: string;
    month?: number;
  },
) {
  const meta = CATALOG.find((item) => item.key === reportKey);
  if (!meta) {
    throw new AppError(404, "Extended report not found", "EXTENDED_REPORT_NOT_FOUND");
  }
  if (query.section && meta.section !== query.section) {
    throw new AppError(400, "Report key does not match section", "SECTION_MISMATCH");
  }
  if (STUB_KEYS.has(reportKey)) {
    return stubReport(reportKey);
  }

  const session = await resolveSession(tenantId, query.sessionId);

  if (reportKey === "staff") {
    const staff = await prisma.staffProfile.findMany({
      where: tenantScope(tenantId, {}),
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true } },
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
      orderBy: { employeeNumber: "asc" },
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: {
        total: staff.length,
        active: staff.filter((s) => s.status === StaffStatus.ACTIVE).length,
        disabled: staff.filter((s) => s.status === StaffStatus.DISABLED).length,
      },
      rows: staff.map((item) => ({
        id: item.id,
        employeeNumber: item.employeeNumber,
        name: nameOf(item.user.firstName, item.user.lastName),
        email: item.user.email,
        phone: item.phone,
        gender: item.gender,
        department: item.department?.name ?? null,
        designation: item.designation?.name ?? null,
        joiningDate: item.joiningDate.toISOString().slice(0, 10),
        status: item.status,
        basicSalary: Number(item.basicSalary),
      })),
    };
  }

  if (reportKey === "payroll") {
    if (!session) {
      throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    }
    const payrolls = await prisma.payroll.findMany({
      where: tenantScope(tenantId, {
        academicSessionId: session.id,
        ...(query.from || query.to
          ? {
              payrollMonth: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lte: query.to } : {}),
              },
            }
          : {}),
      }),
      include: {
        staff: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            department: { select: { name: true } },
          },
        },
        items: true,
      },
      orderBy: [{ payrollMonth: "desc" }, { staff: { employeeNumber: "asc" } }],
      take: 1000,
    });
    const gross = payrolls.reduce((sum, p) => sum + Number(p.grossAmount), 0);
    const net = payrolls.reduce((sum, p) => sum + Number(p.netAmount), 0);
    return {
      reportKey,
      title: meta.label,
      session,
      summary: {
        entries: payrolls.length,
        gross: Number(gross.toFixed(2)),
        net: Number(net.toFixed(2)),
      },
      rows: payrolls.map((item) => ({
        id: item.id,
        employeeNumber: item.staff.employeeNumber,
        staffName: nameOf(item.staff.user.firstName, item.staff.user.lastName),
        department: item.staff.department?.name ?? null,
        payrollMonth: item.payrollMonth.toISOString().slice(0, 7),
        basicSalary: Number(item.basicSalary),
        grossAmount: Number(item.grossAmount),
        attendanceDeduction: Number(item.attendanceDeduction),
        netAmount: Number(item.netAmount),
        status: item.status,
        paidAt: item.paidAt?.toISOString() ?? null,
      })),
    };
  }

  if (reportKey === "staff_birthday") {
    const staff = await prisma.staffProfile.findMany({
      where: tenantScope(tenantId, {
        status: StaffStatus.ACTIVE,
        dateOfBirth: {
          not: null,
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      }),
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
      orderBy: { dateOfBirth: "asc" },
      take: 1000,
    });
    const monthFilter = query.month;
    const rows = staff
      .filter((item) => {
        if (!item.dateOfBirth) return false;
        if (monthFilter == null) return true;
        return item.dateOfBirth.getUTCMonth() + 1 === monthFilter;
      })
      .map((item) => {
        const dob = item.dateOfBirth!;
        const month = dob.getUTCMonth() + 1;
        const day = dob.getUTCDate();
        return {
          id: item.id,
          employeeNumber: item.employeeNumber,
          name: nameOf(item.user.firstName, item.user.lastName),
          email: item.user.email,
          department: item.department?.name ?? null,
          designation: item.designation?.name ?? null,
          dateOfBirth: dob.toISOString().slice(0, 10),
          birthday: `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}`,
        };
      });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: rows.length, month: monthFilter ?? null },
      rows,
    };
  }

  if (reportKey === "user_log") {
    const users = await prisma.user.findMany({
      where: tenantScope(tenantId, {}),
      include: {
        roles: { include: { role: { select: { name: true, code: true } } } },
      },
      orderBy: [{ lastLoginAt: "desc" }, { firstName: "asc" }],
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: {
        total: users.length,
        loggedIn: users.filter((u) => u.lastLoginAt).length,
        neverLoggedIn: users.filter((u) => !u.firstLoginAt).length,
      },
      rows: users.map((user) => ({
        id: user.id,
        name: nameOf(user.firstName, user.lastName),
        email: user.email,
        status: user.status,
        roles: user.roles.map((r) => r.role.name).join(", ") || null,
        firstLoginAt: user.firstLoginAt?.toISOString() ?? null,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        lastLoginChannel: user.lastLoginChannel,
      })),
    };
  }

  if (reportKey === "audit_trail") {
    const logs = await prisma.auditLog.findMany({
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
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: logs.length },
      rows: logs.map((log) => ({
        id: log.id,
        user: nameOf(log.user.firstName, log.user.lastName),
        userEmail: log.user.email,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  if (reportKey === "transport") {
    const students = await prisma.student.findMany({
      where: tenantScope(tenantId, {
        OR: [{ transportOptIn: true }, { transportRoute: { not: null } }],
        status: StudentStatus.ACTIVE,
        ...(query.classSectionId
          ? {
              enrollments: {
                some: {
                  classSectionId: query.classSectionId,
                  status: EnrollmentStatus.ACTIVE,
                  ...(session ? { academicSessionId: session.id } : {}),
                },
              },
            }
          : session
            ? {
                enrollments: {
                  some: {
                    academicSessionId: session.id,
                    status: EnrollmentStatus.ACTIVE,
                  },
                },
              }
            : {}),
      }),
      include: {
        enrollments: {
          where: {
            status: EnrollmentStatus.ACTIVE,
            ...(session ? { academicSessionId: session.id } : {}),
          },
          include: {
            classSection: { include: { academicClass: true, section: true } },
          },
          take: 1,
          orderBy: { enrolledAt: "desc" },
        },
      },
      orderBy: [{ firstName: "asc" }],
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: students.length },
      rows: students.map((student) => ({
        id: student.id,
        admissionNumber: student.admissionNumber,
        name: nameOf(student.firstName, student.lastName),
        classSection: student.enrollments[0]
          ? classSectionLabel(student.enrollments[0].classSection)
          : null,
        transportOptIn: student.transportOptIn,
        transportRoute: student.transportRoute,
        mobile: student.mobile,
      })),
    };
  }

  if (reportKey === "hostel") {
    const students = await prisma.student.findMany({
      where: tenantScope(tenantId, {
        OR: [{ hostelOptIn: true }, { hostelRoom: { not: null } }],
        status: StudentStatus.ACTIVE,
        ...(query.classSectionId
          ? {
              enrollments: {
                some: {
                  classSectionId: query.classSectionId,
                  status: EnrollmentStatus.ACTIVE,
                  ...(session ? { academicSessionId: session.id } : {}),
                },
              },
            }
          : session
            ? {
                enrollments: {
                  some: {
                    academicSessionId: session.id,
                    status: EnrollmentStatus.ACTIVE,
                  },
                },
              }
            : {}),
      }),
      include: {
        enrollments: {
          where: {
            status: EnrollmentStatus.ACTIVE,
            ...(session ? { academicSessionId: session.id } : {}),
          },
          include: {
            classSection: { include: { academicClass: true, section: true } },
          },
          take: 1,
          orderBy: { enrolledAt: "desc" },
        },
      },
      orderBy: [{ firstName: "asc" }],
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: students.length },
      rows: students.map((student) => ({
        id: student.id,
        admissionNumber: student.admissionNumber,
        name: nameOf(student.firstName, student.lastName),
        classSection: student.enrollments[0]
          ? classSectionLabel(student.enrollments[0].classSection)
          : null,
        hostelOptIn: student.hostelOptIn,
        hostelRoom: student.hostelRoom,
        mobile: student.mobile,
      })),
    };
  }

  if (reportKey === "alumni") {
    return runStudentReport(tenantId, "alumni_students", {
      sessionId: query.sessionId,
      from: query.from,
      to: query.to,
      classSectionId: query.classSectionId,
    });
  }

  if (reportKey === "exam_rank_session") {
    if (!session) {
      throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    }
    const exams = await prisma.exam.findMany({
      where: tenantScope(tenantId, {
        status: ExamStatus.PUBLISHED,
        examGroup: { academicSessionId: session.id },
      }),
      include: { examGroup: { select: { name: true } } },
      orderBy: { startDate: "asc" },
    });
    const rows: Array<{
      examId: string;
      examName: string;
      examGroup: string;
      rank: number;
      admissionNumber: string;
      studentName: string;
      classSection: string;
      obtainedMarks: number;
      maximumMarks: number;
      percentage: number;
      grade: string | null;
      passStatus: string;
    }> = [];
    for (const exam of exams) {
      const result = await getExamResults(tenantId, exam.id);
      for (const row of result.results) {
        rows.push({
          examId: exam.id,
          examName: exam.name,
          examGroup: exam.examGroup.name,
          rank: row.rank,
          admissionNumber: row.student.admissionNumber,
          studentName: nameOf(row.student.firstName, row.student.lastName),
          classSection: classSectionLabel(row.classSection),
          obtainedMarks: row.obtainedMarks,
          maximumMarks: row.maximumMarks,
          percentage: row.percentage,
          grade: row.grade,
          passStatus: row.passStatus,
        });
      }
    }
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { exams: exams.length, resultRows: rows.length },
      rows,
    };
  }

  if (reportKey === "exam_cumulative") {
    if (query.examGroupId) {
      const groupResult = await getExamGroupResults(tenantId, query.examGroupId);
      return {
        reportKey,
        title: meta.label,
        session: groupResult.group.academicSession,
        examGroup: { id: groupResult.group.id, name: groupResult.group.name },
        summary: {
          students: groupResult.results.length,
          exams: groupResult.group.exams.length,
          published: groupResult.published,
        },
        rows: groupResult.results.map((row) => ({
          rank: row.rank,
          admissionNumber: row.student.admissionNumber,
          studentName: nameOf(row.student.firstName, row.student.lastName),
          classSection: classSectionLabel(row.classSection),
          obtainedMarks: row.obtainedMarks,
          maximumMarks: row.maximumMarks,
          percentage: row.percentage,
          grade: row.grade,
          gpa: row.gpa,
          passStatus: row.passStatus,
          examsTaken: row.exams.length,
        })),
      };
    }
    if (!session) {
      throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    }
    const groups = await prisma.examGroup.findMany({
      where: tenantScope(tenantId, { academicSessionId: session.id }),
      select: { id: true },
    });
    const combined = new Map<
      string,
      {
        admissionNumber: string;
        studentName: string;
        classSection: string;
        obtainedMarks: number;
        maximumMarks: number;
        examsTaken: number;
        failed: boolean;
      }
    >();
    for (const group of groups) {
      const groupResult = await getExamGroupResults(tenantId, group.id);
      for (const row of groupResult.results) {
        const key = row.student.id;
        const existing = combined.get(key);
        if (existing) {
          existing.obtainedMarks += row.obtainedMarks;
          existing.maximumMarks += row.maximumMarks;
          existing.examsTaken += row.exams.length;
          existing.failed ||= row.passStatus === "FAIL";
        } else {
          combined.set(key, {
            admissionNumber: row.student.admissionNumber,
            studentName: nameOf(row.student.firstName, row.student.lastName),
            classSection: classSectionLabel(row.classSection),
            obtainedMarks: row.obtainedMarks,
            maximumMarks: row.maximumMarks,
            examsTaken: row.exams.length,
            failed: row.passStatus === "FAIL",
          });
        }
      }
    }
    const rows = [...combined.values()]
      .map((row) => ({
        ...row,
        percentage: row.maximumMarks
          ? Number(((row.obtainedMarks / row.maximumMarks) * 100).toFixed(2))
          : 0,
        passStatus: row.failed ? "FAIL" : "PASS",
      }))
      .sort((a, b) => b.obtainedMarks - a.obtainedMarks);
    let rank = 0;
    let lastScore: number | null = null;
    const rankedRows = rows.map((row, index) => {
      if (index === 0 || row.obtainedMarks !== lastScore) rank = index + 1;
      lastScore = row.obtainedMarks;
      return { ...row, rank };
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { students: rankedRows.length, examGroups: groups.length },
      rows: rankedRows,
    };
  }

  throw new AppError(404, "Extended report not found", "EXTENDED_REPORT_NOT_FOUND");
}
