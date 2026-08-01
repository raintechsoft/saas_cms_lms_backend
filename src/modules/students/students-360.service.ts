import {
  EnrollmentStatus,
  ExamStatus,
  PassStatus,
  PaymentStatus,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { AppError } from "../../lib/errors.js";
import { sendMail } from "../../lib/mail.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

function generateTempPassword(prefix: "Stu" | "Par") {
  return `${prefix}@${randomInt(100000, 999999)}`;
}

async function requireStudent(tenantId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: studentId }),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      email: true,
      userId: true,
      status: true,
      disabledReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");
  return student;
}

async function currentEnrollment(tenantId: string, studentId: string) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
    select: { id: true },
  });
  return prisma.studentEnrollment.findFirst({
    where: tenantScope(tenantId, {
      studentId,
      status: EnrollmentStatus.ACTIVE,
      ...(currentSession ? { academicSessionId: currentSession.id } : {}),
    }),
    include: {
      academicSession: { select: { id: true, name: true } },
      classSection: {
        select: {
          id: true,
          academicClass: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });
}

export async function getStudentExams(tenantId: string, studentId: string) {
  await requireStudent(tenantId, studentId);
  const enrollment = await currentEnrollment(tenantId, studentId);
  if (!enrollment) return { enrollment: null, exams: [] };

  const examStudents = await prisma.examStudent.findMany({
    where: tenantScope(tenantId, { studentEnrollmentId: enrollment.id }),
    include: {
      exam: { include: { examGroup: true } },
      marks: {
        include: {
          schedule: {
            include: { classSubject: { include: { subject: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const exams = examStudents.map((examStudent) => {
    const maximumMarks = examStudent.marks.reduce(
      (sum, mark) => sum + Number(mark.schedule.maximumMarks),
      0,
    );
    const obtainedMarks = examStudent.marks.reduce(
      (sum, mark) => sum + Number(mark.marksObtained),
      0,
    );
    const failed = examStudent.marks.some(
      (mark) =>
        mark.isAbsent ||
        Number(mark.marksObtained) < Number(mark.schedule.minimumMarks),
    );
    return {
      examId: examStudent.examId,
      examName: examStudent.exam.name,
      groupName: examStudent.exam.examGroup.name,
      status: examStudent.exam.status,
      published: examStudent.exam.status === ExamStatus.PUBLISHED,
      maximumMarks,
      obtainedMarks,
      percentage: maximumMarks
        ? Number(((obtainedMarks / maximumMarks) * 100).toFixed(2))
        : 0,
      passStatus: failed ? PassStatus.FAIL : PassStatus.PASS,
      subjects: examStudent.marks.map((mark) => ({
        subject: mark.schedule.classSubject.subject.name,
        marksObtained: Number(mark.marksObtained),
        maximumMarks: Number(mark.schedule.maximumMarks),
        isAbsent: mark.isAbsent,
      })),
    };
  });

  return {
    enrollment: {
      id: enrollment.id,
      session: enrollment.academicSession.name,
      className: enrollment.classSection.academicClass.name,
      section: enrollment.classSection.section.name,
    },
    exams,
  };
}

export async function getStudentSubjects(tenantId: string, studentId: string) {
  await requireStudent(tenantId, studentId);
  const enrollment = await currentEnrollment(tenantId, studentId);
  if (!enrollment) {
    return { enrollment: null, coreSubjects: [], electives: [] };
  }

  const [coreSubjects, electives] = await Promise.all([
    prisma.classSubject.findMany({
      where: tenantScope(tenantId, { classSectionId: enrollment.classSectionId }),
      include: {
        subject: { select: { id: true, name: true, code: true, type: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { subject: { name: "asc" } },
    }),
    prisma.studentElectiveAssignment.findMany({
      where: tenantScope(tenantId, { studentEnrollmentId: enrollment.id }),
      include: {
        subject: { select: { id: true, name: true, code: true, type: true } },
        electiveCategory: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    enrollment: {
      id: enrollment.id,
      session: enrollment.academicSession.name,
      className: enrollment.classSection.academicClass.name,
      section: enrollment.classSection.section.name,
    },
    coreSubjects: coreSubjects.map((item) => ({
      id: item.id,
      subject: item.subject,
      teacher: item.teacher
        ? `${item.teacher.firstName} ${item.teacher.lastName}`.trim()
        : null,
    })),
    electives: electives.map((item) => ({
      id: item.id,
      subject: item.subject,
      category: item.electiveCategory?.name ?? null,
    })),
  };
}

export async function getStudentTimeline(tenantId: string, studentId: string) {
  const student = await requireStudent(tenantId, studentId);
  const enrollment = await currentEnrollment(tenantId, studentId);

  const [documents, payments, attendance, audits] = await Promise.all([
    prisma.studentDocument.findMany({
      where: tenantScope(tenantId, { studentId }),
      include: { folder: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.feePayment.findMany({
      where: tenantScope(tenantId, {
        studentId,
        status: PaymentStatus.COLLECTED,
      }),
      orderBy: { paymentDate: "desc" },
      take: 30,
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        receiptNumber: true,
        paymentId: true,
      },
    }),
    enrollment
      ? prisma.attendanceRecord.findMany({
          where: tenantScope(tenantId, { studentEnrollmentId: enrollment.id }),
          orderBy: { attendanceDate: "desc" },
          take: 20,
          select: {
            id: true,
            attendanceDate: true,
            status: true,
            note: true,
          },
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: {
        tenantId,
        OR: [
          { entityId: studentId },
          { action: { contains: `/students/${studentId}` } },
        ],
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  type TimelineItem = {
    id: string;
    type: "ADMISSION" | "STATUS" | "FEE" | "DOCUMENT" | "ATTENDANCE" | "AUDIT";
    title: string;
    detail: string;
    at: string;
  };

  const items: TimelineItem[] = [];

  items.push({
    id: `admission-${student.id}`,
    type: "ADMISSION",
    title: "Student admitted",
    detail: `Admission No. ${student.admissionNumber}`,
    at: student.createdAt.toISOString(),
  });

  if (student.status === "DISABLED") {
    items.push({
      id: `status-${student.id}`,
      type: "STATUS",
      title: "Student disabled",
      detail: student.disabledReason?.trim() || "No reason recorded",
      at: student.updatedAt.toISOString(),
    });
  }

  for (const payment of payments) {
    items.push({
      id: `fee-${payment.id}`,
      type: "FEE",
      title: "Fee collected",
      detail: `Receipt ${payment.receiptNumber ?? payment.paymentId} · Amount ${Number(payment.amount).toFixed(2)}`,
      at: payment.paymentDate.toISOString(),
    });
  }

  for (const doc of documents) {
    items.push({
      id: `doc-${doc.id}`,
      type: "DOCUMENT",
      title: "Document uploaded",
      detail: `${doc.name} (${doc.folder.name})`,
      at: doc.createdAt.toISOString(),
    });
  }

  for (const record of attendance) {
    items.push({
      id: `att-${record.id}`,
      type: "ATTENDANCE",
      title: `Attendance: ${record.status}`,
      detail: record.note?.trim() || record.attendanceDate.toISOString().slice(0, 10),
      at: record.attendanceDate.toISOString(),
    });
  }

  for (const audit of audits) {
    const who = `${audit.user.firstName} ${audit.user.lastName}`.trim() || audit.user.email;
    items.push({
      id: `audit-${audit.id}`,
      type: "AUDIT",
      title: `${audit.entityType} · ${audit.action}`,
      detail: `By ${who}`,
      at: audit.createdAt.toISOString(),
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return { items: items.slice(0, 80) };
}

export async function getStudentPortalAccounts(tenantId: string, studentId: string) {
  const student = await requireStudent(tenantId, studentId);

  const [studentUser, guardians] = await Promise.all([
    student.userId
      ? prisma.user.findFirst({
          where: tenantScope(tenantId, { id: student.userId }),
          select: {
            id: true,
            email: true,
            status: true,
            firstName: true,
            lastName: true,
          },
        })
      : Promise.resolve(null),
    prisma.studentGuardian.findMany({
      where: tenantScope(tenantId, { studentId }),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  return {
    studentAccount: studentUser
      ? {
          userId: studentUser.id,
          role: "STUDENT" as const,
          email: studentUser.email,
          name: `${studentUser.firstName} ${studentUser.lastName ?? ""}`.trim(),
          status: studentUser.status,
          hasLogin: true,
        }
      : {
          userId: null,
          role: "STUDENT" as const,
          email: student.email,
          name: `${student.firstName} ${student.lastName ?? ""}`.trim(),
          status: null,
          hasLogin: false,
        },
    parentAccounts: guardians.map((link) => ({
      userId: link.user.id,
      role: "PARENT" as const,
      email: link.user.email,
      name: `${link.user.firstName} ${link.user.lastName ?? ""}`.trim(),
      status: link.user.status,
      relation: link.relation,
      isPrimary: link.isPrimary,
      hasLogin: true,
    })),
  };
}

export async function resetStudentPortalPassword(
  tenantId: string,
  studentId: string,
  input: {
    role: "STUDENT" | "PARENT";
    guardianUserId?: string | null;
    sendEmail?: boolean;
  },
) {
  const student = await requireStudent(tenantId, studentId);
  let userId: string | null = null;
  let relation: string | null = null;

  if (input.role === "STUDENT") {
    userId = student.userId;
    if (!userId) {
      throw new AppError(404, "Student portal login is not linked", "PORTAL_ACCOUNT_MISSING");
    }
  } else {
    const guardians = await prisma.studentGuardian.findMany({
      where: tenantScope(tenantId, { studentId }),
      select: { userId: true, relation: true, isPrimary: true },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    if (!guardians.length) {
      throw new AppError(404, "No parent portal login is linked", "PORTAL_ACCOUNT_MISSING");
    }
    const match = input.guardianUserId
      ? guardians.find((item) => item.userId === input.guardianUserId)
      : guardians[0];
    if (!match) {
      throw new AppError(404, "Parent portal login was not found", "PORTAL_ACCOUNT_MISSING");
    }
    userId = match.userId;
    relation = match.relation;
  }

  const user = await prisma.user.findFirst({
    where: tenantScope(tenantId, { id: userId }),
    select: { id: true, email: true, status: true, firstName: true },
  });
  if (!user) throw new AppError(404, "Portal user not found", "USER_NOT_FOUND");

  const password = generateTempPassword(input.role === "STUDENT" ? "Stu" : "Par");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      status: UserStatus.ACTIVE,
    },
  });

  let emailSent = false;
  if (input.sendEmail !== false) {
    try {
      await sendMail({
        to: user.email,
        subject: "Your portal login password was reset",
        text: [
          `Hello ${user.firstName},`,
          "",
          `Your ${input.role === "STUDENT" ? "student" : "parent"} portal password was reset by the school admin.`,
          `Email: ${user.email}`,
          `Temporary password: ${password}`,
          "",
          "Please sign in and change your password after login.",
        ].join("\n"),
        tenantId,
      });
      emailSent = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "email failed";
      console.error(`[students-360] password reset email failed: ${message}`);
    }
  }

  return {
    email: user.email,
    password,
    role: input.role,
    relation,
    emailSent,
  };
}
