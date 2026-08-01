import {
  EnrollmentStatus,
  HomeworkStatus,
  HomeworkSubmissionStatus,
  type Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const homeworkInclude = {
  academicSession: true,
  classSection: { include: { academicClass: true, section: true } },
  classSubject: { include: { subject: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { submissions: true } },
} satisfies Prisma.HomeworkInclude;

async function requireHomework(tenantId: string, id: string) {
  const homework = await prisma.homework.findFirst({
    where: tenantScope(tenantId, { id }),
    include: homeworkInclude,
  });
  if (!homework) throw new AppError(404, "Homework not found", "HOMEWORK_NOT_FOUND");
  return homework;
}

async function validateHomeworkInput(
  tenantId: string,
  userId: string,
  input: {
    academicSessionId: string;
    classSectionId: string;
    classSubjectId: string;
    homeworkDate: Date;
    submissionDate: Date;
  },
) {
  if (input.submissionDate < input.homeworkDate) {
    throw new AppError(
      400,
      "Submission date must be on or after homework date",
      "INVALID_DATE_RANGE",
    );
  }
  const classSubject = await prisma.classSubject.findFirst({
    where: tenantScope(tenantId, {
      id: input.classSubjectId,
      classSectionId: input.classSectionId,
    }),
    include: { classSection: { include: { academicSession: true } } },
  });
  if (
    !classSubject ||
    classSubject.classSection.academicSessionId !== input.academicSessionId
  ) {
    throw new AppError(400, "Class subject is invalid", "INVALID_CLASS_SUBJECT");
  }
  const session = classSubject.classSection.academicSession;
  if (
    input.homeworkDate < session.startDate ||
    input.submissionDate > session.endDate
  ) {
    throw new AppError(
      400,
      "Homework dates must be within the academic session",
      "DATE_OUTSIDE_SESSION",
    );
  }
  const user = await prisma.user.findFirst({
    where: tenantScope(tenantId, { id: userId }),
    include: { roles: { include: { role: true } } },
  });
  const isAdmin = user?.roles.some(({ role }) =>
    ["INSTITUTION_ADMIN", "STAFF"].includes(role.code),
  );
  if (!isAdmin && classSubject.teacherId !== userId) {
    throw new AppError(
      403,
      "Teachers can create homework only for assigned subjects",
      "SUBJECT_NOT_ASSIGNED",
    );
  }
  return classSubject;
}

export async function getHomeworkSetup(
  tenantId: string,
  query: {
    sessionId?: string;
    classSectionId?: string;
    status?: HomeworkStatus;
  },
  viewer?: { userId: string; roles: string[] },
) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  const sessionId = query.sessionId ?? currentSession?.id;
  const studentEnrollments = viewer?.roles.includes("STUDENT")
    ? await prisma.studentEnrollment.findMany({
          where: tenantScope(tenantId, {
            status: EnrollmentStatus.ACTIVE,
            student: { userId: viewer.userId },
            ...(sessionId ? { academicSessionId: sessionId } : {}),
          }),
          select: { id: true, classSectionId: true, academicSessionId: true },
        })
    : [];
  const studentClassSectionIds = viewer?.roles.includes("STUDENT")
    ? studentEnrollments.map(({ classSectionId }) => classSectionId)
    : null;
  const homeworkWhere = tenantScope(tenantId, {
    ...(sessionId ? { academicSessionId: sessionId } : {}),
    ...(studentClassSectionIds
      ? { classSectionId: { in: studentClassSectionIds } }
      : query.classSectionId
        ? { classSectionId: query.classSectionId }
        : {}),
    ...(studentClassSectionIds
      ? { status: HomeworkStatus.PUBLISHED }
      : query.status
        ? { status: query.status }
        : {}),
  });
  const [sessions, classSections, homework, homeworkWithAttachment] = await Promise.all([
    prisma.academicSession.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { startDate: "desc" },
    }),
    prisma.classSection.findMany({
      where: tenantScope(tenantId, {
        ...(sessionId ? { academicSessionId: sessionId } : {}),
        ...(studentClassSectionIds ? { id: { in: studentClassSectionIds } } : {}),
      }),
      include: {
        academicClass: true,
        section: true,
        subjects: { include: { subject: true, teacher: true } },
        _count: {
          select: { enrollments: { where: { status: EnrollmentStatus.ACTIVE } } },
        },
      },
      orderBy: [{ academicClass: { sortOrder: "asc" } }, { section: { name: "asc" } }],
    }),
    prisma.homework.findMany({
      where: homeworkWhere,
      // Attachments can be multi-MB data URLs; the list exposes a flag instead
      // and the full record is fetched via GET /homework/:id when needed.
      omit: { attachmentUrl: true },
      include: {
        ...homeworkInclude,
        ...(studentClassSectionIds
          ? {
              submissions: {
                where: {
                  studentEnrollmentId: {
                    in: studentEnrollments.map(({ id }) => id),
                  },
                },
                select: { id: true, status: true, review: true, attempt: true },
              },
            }
          : {}),
      },
      orderBy: [{ homeworkDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.homework.findMany({
      where: { ...homeworkWhere, attachmentUrl: { not: null } },
      select: { id: true },
    }),
  ]);
  const attachmentIds = new Set(homeworkWithAttachment.map(({ id }) => id));
  return {
    currentSession,
    sessions,
    classSections,
    homework: homework.map((item) => ({ ...item, hasAttachment: attachmentIds.has(item.id) })),
    studentEnrollments,
  };
}

export function getHomework(tenantId: string, id: string) {
  return requireHomework(tenantId, id);
}

export async function createHomework(
  tenantId: string,
  userId: string,
  input: {
    academicSessionId: string;
    classSectionId: string;
    classSubjectId: string;
    title: string;
    description: string;
    attachmentUrl?: string | null;
    homeworkDate: Date;
    submissionDate: Date;
    status: HomeworkStatus;
  },
) {
  await validateHomeworkInput(tenantId, userId, input);
  return prisma.homework.create({
    data: { tenantId, teacherId: userId, ...input },
    include: homeworkInclude,
  });
}

export async function updateHomework(
  tenantId: string,
  userId: string,
  id: string,
  input: {
    academicSessionId: string;
    classSectionId: string;
    classSubjectId: string;
    title: string;
    description: string;
    attachmentUrl?: string | null;
    homeworkDate: Date;
    submissionDate: Date;
    status: HomeworkStatus;
  },
) {
  const existing = await requireHomework(tenantId, id);
  if (existing.teacherId !== userId) {
    const admin = await prisma.userRole.findFirst({
      where: {
        tenantId,
        userId,
        role: { code: { in: ["INSTITUTION_ADMIN", "STAFF"] } },
      },
    });
    if (!admin) throw new AppError(403, "Homework belongs to another teacher", "FORBIDDEN");
  }
  await validateHomeworkInput(tenantId, userId, input);
  return prisma.homework.update({
    where: { id },
    data: input,
    include: homeworkInclude,
  });
}

export async function getHomeworkSubmissions(tenantId: string, homeworkId: string) {
  const homework = await requireHomework(tenantId, homeworkId);
  const roster = await prisma.studentEnrollment.findMany({
    where: tenantScope(tenantId, {
      classSectionId: homework.classSectionId,
      academicSessionId: homework.academicSessionId,
      status: EnrollmentStatus.ACTIVE,
    }),
    include: {
      student: true,
      homeworkSubmissions: { where: { homeworkId } },
    },
    orderBy: [{ rollNumber: "asc" }, { student: { firstName: "asc" } }],
  });
  return { homework, roster };
}

export async function submitHomework(
  tenantId: string,
  userId: string,
  homeworkId: string,
  input: {
    studentEnrollmentId: string;
    answerText?: string | null;
    attachmentUrl?: string | null;
  },
) {
  const homework = await requireHomework(tenantId, homeworkId);
  if (homework.status !== HomeworkStatus.PUBLISHED) {
    throw new AppError(409, "Homework is not open for submission", "HOMEWORK_NOT_OPEN");
  }
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: tenantScope(tenantId, {
      id: input.studentEnrollmentId,
      classSectionId: homework.classSectionId,
      academicSessionId: homework.academicSessionId,
      status: EnrollmentStatus.ACTIVE,
    }),
  });
  if (!enrollment) throw new AppError(400, "Student enrolment is invalid", "INVALID_ENROLLMENT");
  const submitter = await prisma.user.findFirst({
    where: tenantScope(tenantId, { id: userId }),
    include: { roles: { include: { role: true } } },
  });
  if (
    submitter?.roles.some(({ role }) => role.code === "STUDENT") &&
    !(await prisma.student.count({
      where: tenantScope(tenantId, {
        id: enrollment.studentId,
        userId,
      }),
    }))
  ) {
    throw new AppError(403, "Students can submit only their own homework", "FORBIDDEN");
  }
  if (!input.answerText?.trim() && !input.attachmentUrl) {
    throw new AppError(400, "Answer text or attachment is required", "SUBMISSION_REQUIRED");
  }
  const existing = await prisma.homeworkSubmission.findUnique({
    where: {
      tenantId_homeworkId_studentEnrollmentId: {
        tenantId,
        homeworkId,
        studentEnrollmentId: input.studentEnrollmentId,
      },
    },
  });
  if (existing && existing.status !== HomeworkSubmissionStatus.RESUBMIT_REQUESTED) {
    throw new AppError(
      409,
      "Student can resubmit only after the teacher requests it",
      "RESUBMIT_NOT_REQUESTED",
    );
  }
  return existing
    ? prisma.homeworkSubmission.update({
        where: { id: existing.id },
        data: {
          ...input,
          status: HomeworkSubmissionStatus.SUBMITTED,
          attempt: { increment: 1 },
          submittedAt: new Date(),
          review: null,
          evaluatedById: null,
          evaluatedAt: null,
        },
        include: { studentEnrollment: { include: { student: true } } },
      })
    : prisma.homeworkSubmission.create({
        data: { tenantId, homeworkId, ...input },
        include: { studentEnrollment: { include: { student: true } } },
      });
}

export async function evaluateHomeworkSubmission(
  tenantId: string,
  userId: string,
  submissionId: string,
  input: {
    status:
      | typeof HomeworkSubmissionStatus.EVALUATED
      | typeof HomeworkSubmissionStatus.COMPLETED
      | typeof HomeworkSubmissionStatus.RESUBMIT_REQUESTED;
    review: string;
  },
) {
  const submission = await prisma.homeworkSubmission.findFirst({
    where: tenantScope(tenantId, { id: submissionId }),
    include: { homework: true },
  });
  if (!submission) {
    throw new AppError(404, "Homework submission not found", "SUBMISSION_NOT_FOUND");
  }
  const canEvaluate =
    submission.homework.teacherId === userId ||
    Boolean(
      await prisma.userRole.findFirst({
        where: {
          tenantId,
          userId,
          role: { code: { in: ["INSTITUTION_ADMIN", "STAFF"] } },
        },
      }),
    );
  if (!canEvaluate) throw new AppError(403, "Submission belongs to another teacher", "FORBIDDEN");
  if (submission.status !== HomeworkSubmissionStatus.SUBMITTED) {
    throw new AppError(409, "Only submitted homework can be evaluated", "INVALID_SUBMISSION_STATUS");
  }
  return prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: {
      ...input,
      evaluatedById: userId,
      evaluatedAt: new Date(),
    },
    include: { studentEnrollment: { include: { student: true } }, homework: true },
  });
}

export async function getHomeworkReport(
  tenantId: string,
  query: { sessionId: string; classSectionId?: string },
) {
  const homework = await prisma.homework.findMany({
    where: tenantScope(tenantId, {
      academicSessionId: query.sessionId,
      ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
    }),
    omit: { attachmentUrl: true },
    include: {
      ...homeworkInclude,
      submissions: true,
      classSection: {
        include: {
          academicClass: true,
          section: true,
          enrollments: {
            where: { status: EnrollmentStatus.ACTIVE },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { submissionDate: "desc" },
  });
  return homework.map((item) => {
    const assigned = item.classSection.enrollments.length;
    const submitted = item.submissions.length;
    const completed = item.submissions.filter(({ status }) =>
      [HomeworkSubmissionStatus.COMPLETED, HomeworkSubmissionStatus.EVALUATED].includes(
        status as typeof HomeworkSubmissionStatus.COMPLETED,
      ),
    ).length;
    const resubmitRequested = item.submissions.filter(
      ({ status }) => status === HomeworkSubmissionStatus.RESUBMIT_REQUESTED,
    ).length;
    return {
      homework: item,
      assigned,
      submitted,
      completed,
      resubmitRequested,
      due: Math.max(0, assigned - submitted),
      progressPercent: assigned ? Number(((completed / assigned) * 100).toFixed(2)) : 0,
    };
  });
}
