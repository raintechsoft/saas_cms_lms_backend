import {
  EnrollmentStatus,
  ExamStatus,
  InventoryMovementType,
  LibraryLoanStatus,
  OnlineAttemptStatus,
  OnlineQuestionType,
  Prisma,
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
  { section: "ops", key: "transport", label: "Transport Report", description: "Students with transport opt-in, route, and stop", available: true },
  { section: "ops", key: "hostel", label: "Hostel Report", description: "Students with hostel opt-in, room, and bed", available: true },
  { section: "alumni", key: "alumni", label: "Alumni Report", description: "Alumni student records", available: true },
  { section: "exams", key: "exam_rank_session", label: "Exam Rank (Session)", description: "Ranks per published exam in session", available: true },
  { section: "exams", key: "exam_cumulative", label: "Cumulative Exam Results", description: "Per-student totals across exams in session/group", available: true },
  { section: "library", key: "book_issue", label: "Book Issue Report", description: "Library book issues", available: true },
  { section: "library", key: "book_due", label: "Book Due Report", description: "Overdue library books", available: true },
  { section: "library", key: "book_inventory", label: "Book Inventory Report", description: "Library inventory", available: true },
  { section: "library", key: "book_return", label: "Book Return Report", description: "Returned library books", available: true },
  { section: "inventory", key: "stock", label: "Stock Report", description: "Inventory stock levels", available: true },
  { section: "inventory", key: "add_item", label: "Add Item Report", description: "Items added to inventory", available: true },
  { section: "inventory", key: "issue_item", label: "Issue Item Report", description: "Items issued from inventory", available: true },
  { section: "onlineExam", key: "online_exam_wise", label: "Online Exam Wise Report", description: "Online exam summary", available: true },
  { section: "onlineExam", key: "online_exams", label: "Online Exams Report", description: "All online exams", available: true },
  { section: "onlineExam", key: "online_attempt", label: "Online Attempt Report", description: "Student online exam attempts", available: true },
  { section: "onlineExam", key: "online_rank", label: "Online Rank Report", description: "Online exam ranks", available: true },
  { section: "onlineExam", key: "subjective_marks", label: "Subjective Marks Report", description: "Subjective exam marks", available: true },
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
  const unavailable = CATALOG.filter((item) => !item.available);
  return {
    library: unavailable.filter((item) => item.section === "library"),
    inventory: unavailable.filter((item) => item.section === "inventory"),
    onlineExam: unavailable.filter((item) => item.section === "onlineExam"),
    lessonPlan: unavailable.filter((item) => item.section === "lessonPlan"),
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
        transportStopName: student.transportStopName,
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
        hostelBedId: student.hostelBedId,
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

  if (
    reportKey === "book_issue" ||
    reportKey === "book_due" ||
    reportKey === "book_return"
  ) {
    const now = new Date();
    const loanWhere: Prisma.LibraryLoanWhereInput = tenantScope(tenantId, {
      ...(reportKey === "book_issue" ? { status: LibraryLoanStatus.ISSUED } : {}),
      ...(reportKey === "book_due" ? { status: LibraryLoanStatus.ISSUED, dueAt: { lt: now } } : {}),
      ...(reportKey === "book_return" ? { status: LibraryLoanStatus.RETURNED } : {}),
      ...(query.from || query.to
        ? {
            issuedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    });
    const loans = await prisma.libraryLoan.findMany({
      where: loanWhere,
      include: {
        book: { select: { title: true, author: true, accessionNo: true, isbn: true } },
        student: {
          select: { admissionNumber: true, firstName: true, lastName: true },
        },
      },
      orderBy: { issuedAt: "desc" },
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: loans.length },
      rows: loans.map((loan) => ({
        id: loan.id,
        admissionNumber: loan.student.admissionNumber,
        student: nameOf(loan.student.firstName, loan.student.lastName),
        book: loan.book.title,
        author: loan.book.author,
        accessionNo: loan.book.accessionNo,
        issuedAt: loan.issuedAt.toISOString(),
        dueAt: loan.dueAt.toISOString(),
        returnedAt: loan.returnedAt?.toISOString() ?? null,
        status: loan.status,
        overdue: loan.status === "ISSUED" && loan.dueAt < now,
      })),
    };
  }

  if (reportKey === "book_inventory") {
    const books = await prisma.libraryBook.findMany({
      where: tenantScope(tenantId, {}),
      include: { category: { select: { name: true } } },
      orderBy: [{ title: "asc" }],
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: {
        total: books.length,
        availableCopies: books.reduce((sum, book) => sum + book.availableCopies, 0),
        totalCopies: books.reduce((sum, book) => sum + book.totalCopies, 0),
      },
      rows: books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        accessionNo: book.accessionNo,
        isbn: book.isbn,
        category: book.category?.name ?? null,
        location: book.location,
        totalCopies: book.totalCopies,
        availableCopies: book.availableCopies,
        isActive: book.isActive,
      })),
    };
  }

  if (reportKey === "stock") {
    const items = await prisma.inventoryItem.findMany({
      where: tenantScope(tenantId, {}),
      include: { category: { select: { name: true } } },
      orderBy: [{ name: "asc" }],
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: {
        total: items.length,
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        lowStock: items.filter((item) => item.quantity <= item.reorderLevel).length,
      },
      rows: items.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category?.name ?? null,
        unit: item.unit,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        location: item.location,
        lowStock: item.quantity <= item.reorderLevel,
        isActive: item.isActive,
      })),
    };
  }

  if (reportKey === "add_item" || reportKey === "issue_item") {
    const type =
      reportKey === "add_item"
        ? InventoryMovementType.ADD
        : InventoryMovementType.ISSUE;
    const movementWhere: Prisma.InventoryMovementWhereInput = tenantScope(tenantId, {
      type,
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    });
    const movements = await prisma.inventoryMovement.findMany({
      where: movementWhere,
      include: {
        item: { select: { name: true, sku: true, unit: true } },
        student: {
          select: { admissionNumber: true, firstName: true, lastName: true },
        },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: movements.length },
      rows: movements.map((row) => ({
        id: row.id,
        item: row.item.name,
        sku: row.item.sku,
        quantity: row.quantity,
        unit: row.item.unit,
        student: row.student
          ? `${row.student.admissionNumber} · ${nameOf(row.student.firstName, row.student.lastName)}`
          : null,
        note: row.note,
        by: row.createdBy ? nameOf(row.createdBy.firstName, row.createdBy.lastName) : null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  if (reportKey === "online_exams") {
    const exams = await prisma.onlineExam.findMany({
      where: tenantScope(tenantId, {}),
      include: {
        academicSession: { select: { name: true } },
        classSection: {
          select: {
            academicClass: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { title: "asc" },
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: {
        total: exams.length,
        published: exams.filter((exam) => exam.status === "PUBLISHED").length,
      },
      rows: exams.map((exam) => ({
        id: exam.id,
        title: exam.title,
        status: exam.status,
        durationMinutes: exam.durationMinutes,
        maxAttempts: exam.maxAttempts,
        passMarks: exam.passMarks,
        session: exam.academicSession?.name ?? null,
        classSection: exam.classSection
          ? classSectionLabel(exam.classSection)
          : null,
        questions: exam._count.questions,
        attempts: exam._count.attempts,
        startsAt: exam.startsAt?.toISOString() ?? null,
        endsAt: exam.endsAt?.toISOString() ?? null,
        isActive: exam.isActive,
      })),
    };
  }

  if (reportKey === "online_exam_wise") {
    const exams = await prisma.onlineExam.findMany({
      where: tenantScope(tenantId, {}),
      include: {
        attempts: {
          where: { status: { in: ["SUBMITTED", "GRADED"] } },
          select: { score: true, maxScore: true, status: true },
        },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { title: "asc" },
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: exams.length },
      rows: exams.map((exam) => {
        const scored = exam.attempts.filter((a) => a.score != null);
        const avg =
          scored.length > 0
            ? scored.reduce((sum, a) => sum + Number(a.score), 0) / scored.length
            : 0;
        const passed = scored.filter(
          (a) => Number(a.score) >= exam.passMarks,
        ).length;
        return {
          id: exam.id,
          title: exam.title,
          status: exam.status,
          questions: exam._count.questions,
          attempts: exam._count.attempts,
          submitted: exam.attempts.length,
          averageScore: Number(avg.toFixed(2)),
          passMarks: exam.passMarks,
          passed,
          passRate:
            scored.length > 0
              ? Number(((passed / scored.length) * 100).toFixed(1))
              : 0,
        };
      }),
    };
  }

  if (reportKey === "online_attempt") {
    const attemptWhere: Prisma.OnlineExamAttemptWhereInput = tenantScope(tenantId, {
      ...(query.from || query.to
        ? {
            startedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    });
    const attempts = await prisma.onlineExamAttempt.findMany({
      where: attemptWhere,
      include: {
        exam: { select: { title: true, passMarks: true } },
        student: {
          select: { admissionNumber: true, firstName: true, lastName: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: attempts.length },
      rows: attempts.map((row) => ({
        id: row.id,
        exam: row.exam.title,
        admissionNumber: row.student.admissionNumber,
        student: nameOf(row.student.firstName, row.student.lastName),
        attemptNo: row.attemptNo,
        status: row.status,
        score: row.score != null ? Number(row.score) : null,
        maxScore: row.maxScore != null ? Number(row.maxScore) : null,
        passMarks: row.exam.passMarks,
        passed:
          row.score != null ? Number(row.score) >= row.exam.passMarks : null,
        rank: row.rank,
        startedAt: row.startedAt.toISOString(),
        submittedAt: row.submittedAt?.toISOString() ?? null,
      })),
    };
  }

  if (reportKey === "online_rank") {
    const rankAttemptWhere: Prisma.OnlineExamAttemptWhereInput = tenantScope(tenantId, {
      status: {
        in: [OnlineAttemptStatus.SUBMITTED, OnlineAttemptStatus.GRADED],
      },
      score: { not: null },
    });
    const attempts = await prisma.onlineExamAttempt.findMany({
      where: rankAttemptWhere,
      include: {
        exam: { select: { title: true, passMarks: true } },
        student: {
          select: { admissionNumber: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ examId: "asc" }, { rank: "asc" }, { score: "desc" }],
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: { total: attempts.length },
      rows: attempts.map((row) => ({
        id: row.id,
        exam: row.exam.title,
        rank: row.rank,
        admissionNumber: row.student.admissionNumber,
        student: nameOf(row.student.firstName, row.student.lastName),
        score: row.score != null ? Number(row.score) : null,
        maxScore: row.maxScore != null ? Number(row.maxScore) : null,
        passMarks: row.exam.passMarks,
        status: row.status,
      })),
    };
  }

  if (reportKey === "subjective_marks") {
    const answerWhere: Prisma.OnlineExamAnswerWhereInput = tenantScope(tenantId, {
      question: { type: OnlineQuestionType.SUBJECTIVE },
    });
    const answers = await prisma.onlineExamAnswer.findMany({
      where: answerWhere,
      include: {
        question: { select: { prompt: true, marks: true, sortOrder: true } },
        attempt: {
          include: {
            exam: { select: { title: true } },
            student: {
              select: {
                admissionNumber: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        gradedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return {
      reportKey,
      title: meta.label,
      session,
      summary: {
        total: answers.length,
        pending: answers.filter((row) => row.marksAwarded == null).length,
      },
      rows: answers.map((row) => ({
        id: row.id,
        exam: row.attempt.exam.title,
        admissionNumber: row.attempt.student.admissionNumber,
        student: nameOf(
          row.attempt.student.firstName,
          row.attempt.student.lastName,
        ),
        question: row.question.prompt.slice(0, 120),
        maxMarks: row.question.marks,
        textAnswer: row.textAnswer,
        marksAwarded: row.marksAwarded != null ? Number(row.marksAwarded) : null,
        gradedBy: row.gradedBy
          ? nameOf(row.gradedBy.firstName, row.gradedBy.lastName)
          : null,
        gradedAt: row.gradedAt?.toISOString() ?? null,
        attemptStatus: row.attempt.status,
      })),
    };
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
