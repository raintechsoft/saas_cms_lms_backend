import {
  HomeworkStatus,
  NoticeAudience,
  type ProductMode,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { createLeave } from "../attendance/attendance.service.js";
import { listStudentFees } from "../fees/fees.service.js";
import { submitHomework } from "../homework/homework.service.js";
import {
  assertAccessibleStudent,
  assertProductMode,
  currentEnrollment,
  portalRole,
  resolveAccessibleStudents,
  type PortalViewer,
} from "./portal-access.js";

export async function getPortalChildAttendance(
  tenantId: string,
  viewer: PortalViewer,
  studentId: string,
  from?: Date,
  to?: Date,
) {
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollment = currentEnrollment(student);
  if (!enrollment) return { summary: null, records: [] };
  const fromDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = to ?? new Date();
  const records = await prisma.attendanceRecord.findMany({
    where: tenantScope(tenantId, {
      studentEnrollmentId: enrollment.id,
      attendanceDate: { gte: fromDate, lte: toDate },
    }),
    orderBy: { attendanceDate: "desc" },
    take: 120,
  });
  return {
    enrollmentId: enrollment.id,
    records: records.map((record) => ({
      id: record.id,
      date: record.attendanceDate,
      status: record.status,
      periodKey: record.periodKey,
      note: record.note,
    })),
  };
}

export async function getPortalChildLeaves(
  tenantId: string,
  viewer: PortalViewer,
  studentId: string,
) {
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollmentIds = student.enrollments.map((item) => item.id);
  return prisma.studentLeave.findMany({
    where: tenantScope(tenantId, { studentEnrollmentId: { in: enrollmentIds } }),
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createPortalLeave(
  tenantId: string,
  viewer: PortalViewer,
  studentId: string,
  input: { fromDate: Date; toDate: Date; reason: string },
) {
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollment = currentEnrollment(student);
  if (!enrollment) throw new AppError(400, "No active enrolment", "NO_ENROLLMENT");
  return createLeave(tenantId, viewer.userId, {
    studentEnrollmentId: enrollment.id,
    fromDate: input.fromDate,
    toDate: input.toDate,
    reason: input.reason,
  });
}

export async function getPortalChildFees(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
) {
  assertProductMode(productMode, "CMS");
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollment = currentEnrollment(student);
  const statement = await listStudentFees(tenantId, studentId, enrollment?.academicSessionId);
  const payments = await prisma.feePayment.findMany({
    where: tenantScope(tenantId, { studentId }),
    include: { items: true },
    orderBy: { paymentDate: "desc" },
    take: 40,
  });
  return {
    statement,
    payments: payments.map((payment) => ({
      id: payment.id,
      paymentId: payment.paymentId,
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate,
      paymentMode: payment.paymentMode,
      amount: payment.amount,
      status: payment.status,
      items: payment.items.map((item) => ({
        amount: item.paidAmount,
        assignmentId: item.assignmentId,
      })),
    })),
  };
}

export async function getPortalChildDocuments(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
) {
  assertProductMode(productMode, "CMS");
  await assertAccessibleStudent(tenantId, viewer, studentId);
  const [documents, generated] = await Promise.all([
    prisma.studentDocument.findMany({
      where: tenantScope(tenantId, { studentId }),
      include: { folder: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.generatedDocument.findMany({
      where: tenantScope(tenantId, { studentId }),
      include: { template: true },
      orderBy: { generatedAt: "desc" },
      take: 50,
    }),
  ]);
  return {
    documents: documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      fileUrl: doc.fileUrl,
      folder: doc.folder.name,
      createdAt: doc.createdAt,
    })),
    certificates: generated.map((doc) => ({
      id: doc.id,
      name: doc.template?.name ?? "Certificate",
      createdAt: doc.generatedAt,
      serialNumber: doc.serialNumber,
    })),
  };
}

export async function getPortalChildTimetable(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
) {
  assertProductMode(productMode, "LMS");
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollment = currentEnrollment(student);
  if (!enrollment) return [];
  const entries = await prisma.timetableEntry.findMany({
    where: tenantScope(tenantId, {
      academicSessionId: enrollment.academicSessionId,
      classSectionId: enrollment.classSectionId,
    }),
    include: {
      classSubject: { include: { subject: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
  return entries.map((entry) => ({
    id: entry.id,
    weekday: entry.weekday,
    startTime: entry.startTime,
    endTime: entry.endTime,
    room: entry.room,
    subject: entry.classSubject.subject.name,
    teacher: entry.teacher
      ? `${entry.teacher.firstName} ${entry.teacher.lastName}`
      : null,
  }));
}

export async function getPortalChildHomework(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
) {
  assertProductMode(productMode, "LMS");
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollment = currentEnrollment(student);
  if (!enrollment) return [];
  const rows = await prisma.homework.findMany({
    where: tenantScope(tenantId, {
      academicSessionId: enrollment.academicSessionId,
      classSectionId: enrollment.classSectionId,
      status: HomeworkStatus.PUBLISHED,
    }),
    include: {
      classSubject: { include: { subject: true } },
      submissions: { where: { studentEnrollmentId: enrollment.id } },
    },
    orderBy: { submissionDate: "asc" },
    take: 50,
  });
  return rows.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    subject: item.classSubject.subject.name,
    homeworkDate: item.homeworkDate,
    submissionDate: item.submissionDate,
    attachmentUrl: item.attachmentUrl,
    studentEnrollmentId: enrollment.id,
    submission: item.submissions[0]
      ? {
          id: item.submissions[0].id,
          status: item.submissions[0].status,
          review: item.submissions[0].review,
          attempt: item.submissions[0].attempt,
        }
      : null,
  }));
}

export async function submitPortalHomework(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  homeworkId: string,
  answerText: string,
  attachmentUrl?: string | null,
) {
  assertProductMode(productMode, "LMS");
  if (portalRole(viewer) !== "STUDENT") {
    throw new AppError(403, "Only students can submit homework", "PORTAL_FORBIDDEN");
  }
  const links = await resolveAccessibleStudents(tenantId, viewer);
  const student = links[0]?.student;
  if (!student) throw new AppError(404, "Student profile not found", "PORTAL_NO_STUDENTS");
  const enrollment = currentEnrollment(student);
  if (!enrollment) throw new AppError(400, "No active enrolment", "NO_ENROLLMENT");
  return submitHomework(tenantId, viewer.userId, homeworkId, {
    studentEnrollmentId: enrollment.id,
    answerText,
    attachmentUrl,
  });
}

export async function listPortalNotices(
  tenantId: string,
  viewer: PortalViewer,
  studentId?: string,
) {
  const role = portalRole(viewer);
  const audience =
    role === "STUDENT"
      ? [NoticeAudience.ALL, NoticeAudience.STUDENTS]
      : [NoticeAudience.ALL, NoticeAudience.PARENTS];
  let classSectionId: string | undefined;
  if (studentId) {
    const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
    classSectionId = currentEnrollment(student)?.classSectionId;
  }
  const now = new Date();
  return prisma.notice.findMany({
    where: tenantScope(tenantId, {
      audience: { in: audience },
      publishedAt: { lte: now },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        classSectionId
          ? { OR: [{ classSectionId: null }, { classSectionId }] }
          : {},
      ],
    }),
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      classSection: { include: { academicClass: true, section: true } },
    },
  });
}

export async function updatePortalStudentProfile(
  tenantId: string,
  viewer: PortalViewer,
  studentId: string,
  input: {
    firstName?: string;
    lastName?: string | null;
    mobile?: string | null;
    email?: string | null;
    currentAddress?: string | null;
    photoUrl?: string | null;
  },
) {
  await assertAccessibleStudent(tenantId, viewer, studentId);
  const student = await prisma.student.update({
    where: { id: studentId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName?.trim() || null } : {}),
      ...(input.mobile !== undefined ? { mobile: input.mobile?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.currentAddress !== undefined
        ? { currentAddress: input.currentAddress?.trim() || null }
        : {}),
      ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
    },
  });

  if (student.userId && (input.firstName || input.lastName || input.photoUrl || input.mobile)) {
    await prisma.user.update({
      where: { id: student.userId },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName?.trim() || "" } : {}),
        ...(input.mobile !== undefined ? { phone: input.mobile?.trim() || null } : {}),
        ...(input.photoUrl !== undefined ? { avatarUrl: input.photoUrl } : {}),
      },
    });
  }

  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    mobile: student.mobile,
    email: student.email,
    currentAddress: student.currentAddress,
    photoUrl: student.photoUrl,
    admissionNumber: student.admissionNumber,
  };
}
