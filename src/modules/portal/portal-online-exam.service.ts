import { OnlineExamStatus, ProductMode } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import {
  startOnlineAttempt,
  submitOnlineAttempt,
  type AttemptAnswerInput,
} from "../online-exam/online-exam.service.js";
import {
  assertAccessibleStudent,
  assertProductMode,
  currentEnrollment,
  portalRole,
  type PortalViewer,
} from "./portal-access.js";

function stripQuestion<T extends { correctOption?: number | null }>(question: T) {
  const { correctOption: _correctOption, ...safe } = question;
  return safe;
}

function examVisibleToStudent(
  exam: {
    status: OnlineExamStatus;
    isActive: boolean;
    academicSessionId: string | null;
    classSectionId: string | null;
  },
  enrollment: { academicSessionId: string; classSectionId: string } | null,
) {
  if (!exam.isActive || exam.status !== OnlineExamStatus.PUBLISHED) return false;
  if (!enrollment) {
    return !exam.academicSessionId && !exam.classSectionId;
  }
  if (
    exam.academicSessionId &&
    exam.academicSessionId !== enrollment.academicSessionId
  ) {
    return false;
  }
  if (exam.classSectionId && exam.classSectionId !== enrollment.classSectionId) {
    return false;
  }
  return true;
}

function examOpenNow(exam: { startsAt: Date | null; endsAt: Date | null }) {
  const now = new Date();
  if (exam.startsAt && exam.startsAt > now) return false;
  if (exam.endsAt && exam.endsAt < now) return false;
  return true;
}

function examAvailabilityNote(
  exam: { startsAt: Date | null; endsAt: Date | null },
  enrollment: { academicSessionId: string; classSectionId: string } | null,
  questionCount: number,
) {
  if (!enrollment) return "No active class enrollment linked to this student";
  if (questionCount <= 0) return "School has not added questions yet";
  const now = new Date();
  if (exam.startsAt && exam.startsAt > now) {
    return `Starts ${exam.startsAt.toISOString()}`;
  }
  if (exam.endsAt && exam.endsAt < now) return "Exam window has ended";
  return null;
}

/** @deprecated use examVisibleToStudent + examOpenNow */
function examAvailableToStudent(
  exam: {
    status: OnlineExamStatus;
    isActive: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    academicSessionId: string | null;
    classSectionId: string | null;
  },
  enrollment: { academicSessionId: string; classSectionId: string } | null,
) {
  return examVisibleToStudent(exam, enrollment) && examOpenNow(exam);
}

/** Results (score / pass / rank) are hidden until staff finishes grading. */
function isResultReleased(status: string) {
  return status === "GRADED";
}

function maskAttemptResult<T extends {
  status: string;
  score?: unknown;
  maxScore?: unknown;
  rank?: number | null;
  passed?: boolean | null;
}>(row: T) {
  if (isResultReleased(row.status)) {
    return {
      ...row,
      score: row.score != null ? Number(row.score) : null,
      maxScore: row.maxScore != null ? Number(row.maxScore) : null,
    };
  }
  return {
    ...row,
    score: null,
    maxScore: null,
    rank: null,
    passed: null,
    resultPending: true as const,
  };
}

export async function listPortalOnlineExams(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
) {
  assertProductMode(productMode, "CMS");
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollment = currentEnrollment(student);
  const exams = await prisma.onlineExam.findMany({
    where: tenantScope(tenantId, {
      isActive: true,
      status: OnlineExamStatus.PUBLISHED,
    }),
    include: {
      _count: { select: { questions: true } },
      attempts: {
        where: { studentId },
        select: {
          id: true,
          attemptNo: true,
          status: true,
          score: true,
          maxScore: true,
          rank: true,
          submittedAt: true,
        },
        orderBy: { attemptNo: "desc" },
      },
    },
    orderBy: [{ startsAt: "desc" }, { title: "asc" }],
    take: 200,
  });

  return exams
    .filter((exam) =>
      examVisibleToStudent(
        exam,
        enrollment
          ? {
              academicSessionId: enrollment.academicSessionId,
              classSectionId: enrollment.classSectionId,
            }
          : null,
      ),
    )
    .map((exam) => {
      const openNow = examOpenNow(exam);
      const questionCount = exam._count.questions;
      const availabilityNote = examAvailabilityNote(exam, enrollment
        ? {
            academicSessionId: enrollment.academicSessionId,
            classSectionId: enrollment.classSectionId,
          }
        : null, questionCount);
      const inProgressAttempt =
        exam.attempts.find((a) => a.status === "IN_PROGRESS") ?? null;
      const attemptsUsed = exam.attempts.length;
      return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      maxAttempts: exam.maxAttempts,
      passMarks: Number(exam.passMarks),
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
      questionCount,
      isOpenNow: openNow,
      availabilityNote,
      attemptsUsed,
      attemptsRemaining: Math.max(0, exam.maxAttempts - attemptsUsed),
      canAttempt:
        questionCount > 0 &&
        portalRole(viewer) === "STUDENT" &&
        (inProgressAttempt != null ||
          (openNow && attemptsUsed < exam.maxAttempts)),
      latestAttempt: exam.attempts[0]
        ? maskAttemptResult({
            id: exam.attempts[0].id,
            attemptNo: exam.attempts[0].attemptNo,
            status: exam.attempts[0].status,
            score: exam.attempts[0].score,
            maxScore: exam.attempts[0].maxScore,
            rank: exam.attempts[0].rank,
            submittedAt: exam.attempts[0].submittedAt,
          })
        : null,
      inProgressAttempt,
      };
    });
}

export async function getPortalOnlineExamPaper(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
  examId: string,
) {
  assertProductMode(productMode, "CMS");
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  const enrollment = currentEnrollment(student);
  const exam = await prisma.onlineExam.findFirst({
    where: tenantScope(tenantId, { id: examId, isActive: true }),
    include: {
      questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      attempts: {
        where: { studentId },
        select: { id: true, attemptNo: true, status: true },
        orderBy: { attemptNo: "desc" },
      },
    },
  });
  if (!exam) throw new AppError(404, "Online exam not found", "ONLINE_EXAM_NOT_FOUND");
  const enrollmentCtx = enrollment
    ? {
        academicSessionId: enrollment.academicSessionId,
        classSectionId: enrollment.classSectionId,
      }
    : null;
  if (!examVisibleToStudent(exam, enrollmentCtx)) {
    throw new AppError(403, "Exam is not available", "EXAM_UNAVAILABLE");
  }

  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    durationMinutes: exam.durationMinutes,
    maxAttempts: exam.maxAttempts,
    passMarks: Number(exam.passMarks),
    startsAt: exam.startsAt,
    endsAt: exam.endsAt,
    attemptsUsed: exam.attempts.length,
    attemptsRemaining: Math.max(0, exam.maxAttempts - exam.attempts.length),
    inProgressAttemptId:
      exam.attempts.find((a) => a.status === "IN_PROGRESS")?.id ?? null,
    questions: exam.questions.map((q) => ({
      ...stripQuestion(q),
      options: Array.isArray(q.options) ? q.options : null,
    })),
  };
}

export async function startPortalOnlineAttempt(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
  examId: string,
) {
  assertProductMode(productMode, "CMS");
  if (portalRole(viewer) !== "STUDENT") {
    throw new AppError(403, "Only students can start online exams", "PORTAL_FORBIDDEN");
  }
  const { student } = await assertAccessibleStudent(tenantId, viewer, studentId);
  if (student.userId !== viewer.userId) {
    throw new AppError(403, "Only the student can start this exam", "PORTAL_FORBIDDEN");
  }

  const inProgress = await prisma.onlineExamAttempt.findFirst({
    where: tenantScope(tenantId, {
      examId,
      studentId,
      status: "IN_PROGRESS",
    }),
    select: { id: true },
  });

  // Validate availability (published + class/session). Skip date window when resuming.
  if (!inProgress) {
    await getPortalOnlineExamPaper(tenantId, viewer, productMode, studentId, examId);
  } else {
    const { student: linkedStudent } = await assertAccessibleStudent(tenantId, viewer, studentId);
    const enrollment = currentEnrollment(linkedStudent);
    const exam = await prisma.onlineExam.findFirst({
      where: tenantScope(tenantId, { id: examId, isActive: true }),
      select: {
        status: true,
        isActive: true,
        academicSessionId: true,
        classSectionId: true,
      },
    });
    if (!exam || !examVisibleToStudent(exam, enrollment
      ? {
          academicSessionId: enrollment.academicSessionId,
          classSectionId: enrollment.classSectionId,
        }
      : null)) {
      throw new AppError(403, "Exam is not available", "EXAM_UNAVAILABLE");
    }
  }

  const attempt = await startOnlineAttempt(
    tenantId,
    { examId, studentId },
    { requirePublished: true },
  );

  const paper = await getPortalOnlineExamPaper(
    tenantId,
    viewer,
    productMode,
    studentId,
    examId,
  );

  return {
    attempt: {
      id: attempt.id,
      attemptNo: attempt.attemptNo,
      status: attempt.status,
      startedAt: attempt.startedAt,
      maxScore: attempt.maxScore != null ? Number(attempt.maxScore) : null,
      examId: attempt.examId,
    },
    paper,
  };
}

export async function submitPortalOnlineAttempt(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
  attemptId: string,
  answers: AttemptAnswerInput[],
) {
  assertProductMode(productMode, "CMS");
  if (portalRole(viewer) !== "STUDENT") {
    throw new AppError(403, "Only students can submit online exams", "PORTAL_FORBIDDEN");
  }
  await assertAccessibleStudent(tenantId, viewer, studentId);

  const attempt = await prisma.onlineExamAttempt.findFirst({
    where: tenantScope(tenantId, { id: attemptId, studentId }),
    select: { id: true, studentId: true },
  });
  if (!attempt) throw new AppError(404, "Attempt not found", "ONLINE_ATTEMPT_NOT_FOUND");

  const result = await submitOnlineAttempt(tenantId, attemptId, answers);
  const released = isResultReleased(result.status);
  return {
    id: result.id,
    status: result.status,
    score: released && result.score != null ? Number(result.score) : null,
    maxScore: released && result.maxScore != null ? Number(result.maxScore) : null,
    rank: released ? result.rank : null,
    submittedAt: result.submittedAt,
    resultPending: !released,
    exam: result.exam,
  };
}

export async function listPortalOnlineAttempts(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
  examId?: string,
) {
  assertProductMode(productMode, "CMS");
  await assertAccessibleStudent(tenantId, viewer, studentId);

  const attempts = await prisma.onlineExamAttempt.findMany({
    where: tenantScope(tenantId, {
      studentId,
      ...(examId ? { examId } : {}),
    }),
    include: {
      exam: {
        select: { id: true, title: true, passMarks: true, durationMinutes: true },
      },
    },
    orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
    take: 200,
  });

  return attempts.map((row) =>
    maskAttemptResult({
      id: row.id,
      attemptNo: row.attemptNo,
      status: row.status,
      score: row.score,
      maxScore: row.maxScore,
      rank: row.rank,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      passed:
        row.score != null ? Number(row.score) >= row.exam.passMarks : null,
      exam: row.exam,
    }),
  );
}

export async function getPortalOnlineAttempt(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null,
  studentId: string,
  attemptId: string,
) {
  assertProductMode(productMode, "CMS");
  await assertAccessibleStudent(tenantId, viewer, studentId);

  const attempt = await prisma.onlineExamAttempt.findFirst({
    where: tenantScope(tenantId, { id: attemptId, studentId }),
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          passMarks: true,
          durationMinutes: true,
        },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              type: true,
              prompt: true,
              marks: true,
              options: true,
              sortOrder: true,
            },
          },
        },
        orderBy: { question: { sortOrder: "asc" } },
      },
    },
  });
  if (!attempt) throw new AppError(404, "Attempt not found", "ONLINE_ATTEMPT_NOT_FOUND");

  const released = isResultReleased(attempt.status);
  return {
    id: attempt.id,
    attemptNo: attempt.attemptNo,
    status: attempt.status,
    score: released ? attempt.score : null,
    maxScore: released ? attempt.maxScore : null,
    rank: released ? attempt.rank : null,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    resultPending: !released,
    passed:
      released && attempt.score != null
        ? Number(attempt.score) >= attempt.exam.passMarks
        : null,
    exam: attempt.exam,
    answers: attempt.answers.map((answer) => ({
      id: answer.id,
      selectedOption: answer.selectedOption,
      textAnswer: answer.textAnswer,
      marksAwarded: released ? answer.marksAwarded : null,
      isCorrect: released ? answer.isCorrect : null,
      question: {
        ...answer.question,
        options: Array.isArray(answer.question.options)
          ? answer.question.options
          : null,
      },
    })),
  };
}
