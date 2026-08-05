import {
  HomeworkStatus,
  NoticeAudience,
  StaffStatus,
  type ProductMode,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { createLeave } from "../attendance/attendance.service.js";
import { listStudentFees } from "../fees/fees.service.js";
import { addTeacherRating } from "../hr/hr.service.js";
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

  // Default to current academic session window when available, else last 12 months.
  const session = enrollment.academicSession;
  const fromDate =
    from ??
    (session?.startDate
      ? new Date(session.startDate)
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
  const toDate = to ?? (session?.endDate ? new Date(session.endDate) : new Date());

  const records = await prisma.attendanceRecord.findMany({
    where: tenantScope(tenantId, {
      studentEnrollmentId: enrollment.id,
      attendanceDate: { gte: fromDate, lte: toDate },
    }),
    orderBy: { attendanceDate: "desc" },
    take: 400,
  });

  const counts = records.reduce(
    (acc, record) => {
      acc.total += 1;
      if (record.status === "PRESENT") acc.present += 1;
      if (record.status === "LATE") acc.late += 1;
      if (record.status === "ABSENT") acc.absent += 1;
      if (record.status === "HALF_DAY") acc.halfDay += 1;
      if (record.status === "HOLIDAY") acc.holiday += 1;
      return acc;
    },
    { total: 0, present: 0, late: 0, absent: 0, halfDay: 0, holiday: 0 },
  );
  const counted = counts.total - counts.holiday;
  const attended = counts.present + counts.late + counts.halfDay * 0.5;
  const percentage = counted ? Number(((attended / counted) * 100).toFixed(1)) : 0;

  return {
    enrollmentId: enrollment.id,
    period: {
      from: fromDate,
      to: toDate,
      label: session?.name ?? null,
    },
    summary: { ...counts, percentage },
    records: records.map((record) => ({
      id: record.id,
      date: record.attendanceDate,
      status: record.status,
      periodKey: record.periodKey,
      inTime: record.inTime,
      outTime: record.outTime,
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
    include: {
      items: {
        include: {
          assignment: {
            include: {
              feeMaster: { include: { feeType: true } },
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: 40,
  });

  const dueAssignment = statement.assignments.find((item) => item.totals.balance > 0) ?? null;

  return {
    academicSessionId: enrollment?.academicSessionId ?? null,
    statement,
    due: dueAssignment
      ? {
          amount: dueAssignment.totals.balance,
          dueDate: dueAssignment.feeMaster.dueDate,
          name: dueAssignment.feeMaster.feeType?.name ?? "Fee",
          overdue: new Date(dueAssignment.feeMaster.dueDate) < new Date(),
        }
      : null,
    payments: payments.map((payment) => {
      const feeNames = [
        ...new Set(
          payment.items
            .map((item) => item.assignment?.feeMaster?.feeType?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      const totalAssigned = payment.items.reduce((sum, item) => sum + Number(item.paidAmount), 0);
      return {
        id: payment.id,
        paymentId: payment.paymentId,
        receiptNumber: payment.receiptNumber,
        paymentDate: payment.paymentDate,
        paymentMode: payment.paymentMode,
        amount: payment.amount,
        status: payment.status,
        label: feeNames[0] ?? payment.paymentMode,
        feeNames,
        partial: totalAssigned > 0 && Number(payment.amount) < totalAssigned,
        items: payment.items.map((item) => ({
          amount: item.paidAmount,
          assignmentId: item.assignmentId,
          feeName: item.assignment?.feeMaster?.feeType?.name ?? null,
        })),
      };
    }),
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
      where: tenantScope(tenantId, { studentId, deletedAt: null }),
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
      folderId: doc.folder.id,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt,
    })),
    certificates: generated.map((doc) => ({
      id: doc.id,
      name: doc.template?.name ?? "Certificate",
      createdAt: doc.generatedAt,
      serialNumber: doc.serialNumber,
    })),
    folders: await prisma.studentDocumentFolder.findMany({
      where: tenantScope(tenantId, {}),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  };
}

export async function uploadPortalChildDocument(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
  input: {
    folderId: string;
    name?: string;
    file: Express.Multer.File;
  },
) {
  assertProductMode(productMode, "CMS");
  await assertAccessibleStudent(tenantId, viewer, studentId);
  const { uploadStudentDocumentFile } = await import("../students/student-documents.service.js");
  return uploadStudentDocumentFile(tenantId, viewer.userId, {
    studentId,
    folderId: input.folderId,
    name: input.name,
    file: input.file,
  });
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
  assertProductMode(productMode, "SHARED");
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
  answerText?: string | null,
  attachmentUrl?: string | null,
) {
  assertProductMode(productMode, "SHARED");
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
    answerText: answerText ?? null,
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

export async function listPortalTeachers(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
) {
  assertProductMode(productMode, "CMS");
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollment = currentEnrollment(student);
  if (!enrollment) return [];

  const classSubjects = await prisma.classSubject.findMany({
    where: tenantScope(tenantId, {
      classSectionId: enrollment.classSectionId,
      teacherId: { not: null },
    }),
    include: {
      subject: true,
      teacher: {
        include: {
          staffProfile: {
            include: { designation: true },
          },
        },
      },
    },
  });

  const byStaff = new Map<
    string,
    {
      id: string;
      staffId: string;
      name: string;
      subject: string | null;
      photoUrl: string | null;
      designation: string | null;
      subjects: Set<string>;
    }
  >();

  for (const item of classSubjects) {
    const staff = item.teacher?.staffProfile;
    if (!staff || staff.status !== StaffStatus.ACTIVE) continue;
    const existing = byStaff.get(staff.id);
    if (existing) {
      existing.subjects.add(item.subject.name);
      existing.subject = [...existing.subjects].sort().join(", ");
      continue;
    }
    byStaff.set(staff.id, {
      id: staff.userId,
      staffId: staff.id,
      name: `${item.teacher!.firstName} ${item.teacher!.lastName}`.trim(),
      subject: item.subject.name,
      photoUrl: staff.photoUrl ?? item.teacher!.avatarUrl,
      designation: staff.designation?.name ?? null,
      subjects: new Set([item.subject.name]),
    });
  }

  return [...byStaff.values()]
    .map(({ subjects: _subjects, ...row }) => row)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function submitPortalTeacherRating(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
  staffId: string,
  input: { rating: number; comment?: string | null; ratingDate: Date },
) {
  assertProductMode(productMode, "CMS");
  await assertAccessibleStudent(tenantId, viewer, studentId);
  const teachers = await listPortalTeachers(tenantId, viewer, productMode, studentId);
  if (!teachers.some((item) => item.staffId === staffId)) {
    throw new AppError(400, "Teacher is not assigned to this student", "INVALID_TEACHER");
  }
  return addTeacherRating(tenantId, viewer.userId, {
    staffId,
    rating: input.rating,
    comment: input.comment,
    ratingDate: input.ratingDate,
  });
}
