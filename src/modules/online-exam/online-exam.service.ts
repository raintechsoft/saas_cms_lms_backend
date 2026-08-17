import {
  OnlineAttemptStatus,
  OnlineExamStatus,
  OnlineQuestionType,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type OnlineExamInput = {
  title: string;
  description?: string | null;
  academicSessionId?: string | null;
  classSectionId?: string | null;
  durationMinutes?: number;
  maxAttempts?: number;
  passMarks?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  status?: OnlineExamStatus;
};

export type OnlineQuestionInput = {
  type: OnlineQuestionType;
  prompt: string;
  options?: string[] | null;
  correctOption?: number | null;
  marks?: number;
  sortOrder?: number;
};

export type AttemptAnswerInput = {
  questionId: string;
  selectedOption?: number | null;
  textAnswer?: string | null;
};

function examInclude() {
  return {
    academicSession: { select: { id: true, name: true } },
    classSection: {
      select: {
        id: true,
        academicClass: { select: { name: true } },
        section: { select: { name: true } },
      },
    },
    _count: { select: { questions: true, attempts: true } },
  } as const;
}

function attemptInclude() {
  return {
    exam: { select: { id: true, title: true, passMarks: true, status: true } },
    student: {
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
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
            correctOption: true,
            sortOrder: true,
          },
        },
      },
      orderBy: { question: { sortOrder: "asc" as const } },
    },
  } as const;
}

function num(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

async function recalcRanks(tenantId: string, examId: string) {
  const attempts = await prisma.onlineExamAttempt.findMany({
    where: tenantScope(tenantId, {
      examId,
      status: { in: [OnlineAttemptStatus.SUBMITTED, OnlineAttemptStatus.GRADED] },
      score: { not: null },
    }),
    orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
    select: { id: true },
  });
  await Promise.all(
    attempts.map((attempt, index) =>
      prisma.onlineExamAttempt.update({
        where: { id: attempt.id },
        data: { rank: index + 1 },
      }),
    ),
  );
}

export async function onlineExamSummary(tenantId: string) {
  const [exams, published, questions, attempts, pendingGrade] = await Promise.all([
    prisma.onlineExam.count({ where: tenantScope(tenantId, { isActive: true }) }),
    prisma.onlineExam.count({
      where: tenantScope(tenantId, { isActive: true, status: OnlineExamStatus.PUBLISHED }),
    }),
    prisma.onlineExamQuestion.count({ where: tenantScope(tenantId, {}) }),
    prisma.onlineExamAttempt.count({ where: tenantScope(tenantId, {}) }),
    prisma.onlineExamAnswer.count({
      where: tenantScope(tenantId, {
        marksAwarded: null,
        question: { type: OnlineQuestionType.SUBJECTIVE },
        attempt: { status: { in: [OnlineAttemptStatus.SUBMITTED, OnlineAttemptStatus.GRADED] } },
      }),
    }),
  ]);
  return { exams, published, questions, attempts, pendingGrade };
}

export async function listOnlineExams(tenantId: string, q?: string) {
  return prisma.onlineExam.findMany({
    where: tenantScope(tenantId, {
      ...(q?.trim()
        ? { title: { contains: q.trim(), mode: "insensitive" as const } }
        : {}),
    }),
    include: examInclude(),
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });
}

export async function getOnlineExam(tenantId: string, id: string) {
  const exam = await prisma.onlineExam.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      ...examInclude(),
      questions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!exam) throw new AppError(404, "Online exam not found", "ONLINE_EXAM_NOT_FOUND");
  return exam;
}

export async function createOnlineExam(
  tenantId: string,
  input: OnlineExamInput,
  createdById?: string,
) {
  if (input.academicSessionId) {
    const session = await prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: input.academicSessionId }),
      select: { id: true },
    });
    if (!session) throw new AppError(404, "Academic session not found", "SESSION_NOT_FOUND");
  }
  if (input.classSectionId) {
    const section = await prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: input.classSectionId }),
      select: { id: true },
    });
    if (!section) throw new AppError(404, "Class section not found", "CLASS_SECTION_NOT_FOUND");
  }

  return prisma.onlineExam.create({
    data: {
      tenantId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      academicSessionId: input.academicSessionId || null,
      classSectionId: input.classSectionId || null,
      durationMinutes: input.durationMinutes ?? 60,
      maxAttempts: input.maxAttempts ?? 1,
      passMarks: input.passMarks ?? 0,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: input.isActive ?? true,
      status: input.status ?? OnlineExamStatus.DRAFT,
      createdById: createdById || null,
    },
    include: examInclude(),
  });
}

export async function updateOnlineExam(
  tenantId: string,
  id: string,
  input: Partial<OnlineExamInput>,
) {
  const found = await prisma.onlineExam.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Online exam not found", "ONLINE_EXAM_NOT_FOUND");

  if (input.status === OnlineExamStatus.PUBLISHED) {
    const questionCount = await prisma.onlineExamQuestion.count({
      where: tenantScope(tenantId, { examId: id }),
    });
    if (questionCount === 0) {
      throw new AppError(
        400,
        "Add at least one question before publishing the exam",
        "EXAM_NO_QUESTIONS",
      );
    }
  }

  return prisma.onlineExam.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.academicSessionId !== undefined
        ? { academicSessionId: input.academicSessionId || null }
        : {}),
      ...(input.classSectionId !== undefined
        ? { classSectionId: input.classSectionId || null }
        : {}),
      ...(input.durationMinutes !== undefined
        ? { durationMinutes: input.durationMinutes }
        : {}),
      ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts } : {}),
      ...(input.passMarks !== undefined ? { passMarks: input.passMarks } : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
        : {}),
      ...(input.endsAt !== undefined
        ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: examInclude(),
  });
}

export async function deleteOnlineExam(tenantId: string, id: string) {
  const found = await prisma.onlineExam.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Online exam not found", "ONLINE_EXAM_NOT_FOUND");
  await prisma.onlineExam.delete({ where: { id } });
}

export async function listOnlineQuestions(tenantId: string, examId: string) {
  const exam = await prisma.onlineExam.findFirst({
    where: tenantScope(tenantId, { id: examId }),
    select: { id: true },
  });
  if (!exam) throw new AppError(404, "Online exam not found", "ONLINE_EXAM_NOT_FOUND");
  return prisma.onlineExamQuestion.findMany({
    where: tenantScope(tenantId, { examId }),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createOnlineQuestion(
  tenantId: string,
  examId: string,
  input: OnlineQuestionInput,
) {
  const exam = await prisma.onlineExam.findFirst({
    where: tenantScope(tenantId, { id: examId }),
    select: { id: true },
  });
  if (!exam) throw new AppError(404, "Online exam not found", "ONLINE_EXAM_NOT_FOUND");

  if (input.type === OnlineQuestionType.MCQ) {
    const options = (input.options ?? []).map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      throw new AppError(400, "MCQ needs at least 2 options", "INVALID_MCQ_OPTIONS");
    }
    if (
      input.correctOption == null ||
      input.correctOption < 0 ||
      input.correctOption >= options.length
    ) {
      throw new AppError(400, "Valid correct option index required", "INVALID_CORRECT_OPTION");
    }
    return prisma.onlineExamQuestion.create({
      data: {
        tenantId,
        examId,
        type: OnlineQuestionType.MCQ,
        prompt: input.prompt.trim(),
        options,
        correctOption: input.correctOption,
        marks: input.marks ?? 1,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  return prisma.onlineExamQuestion.create({
    data: {
      tenantId,
      examId,
      type: OnlineQuestionType.SUBJECTIVE,
      prompt: input.prompt.trim(),
      options: Prisma.JsonNull,
      correctOption: null,
      marks: input.marks ?? 5,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateOnlineQuestion(
  tenantId: string,
  id: string,
  input: Partial<OnlineQuestionInput>,
) {
  const found = await prisma.onlineExamQuestion.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Question not found", "ONLINE_QUESTION_NOT_FOUND");

  const type = input.type ?? found.type;
  let options: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
  let correctOption: number | null | undefined;

  if (type === OnlineQuestionType.MCQ) {
    if (input.options === null) {
      throw new AppError(400, "MCQ needs at least 2 options", "INVALID_MCQ_OPTIONS");
    }
    const nextOptions =
      input.options !== undefined
        ? input.options.map((o) => o.trim()).filter(Boolean)
        : Array.isArray(found.options)
          ? (found.options as string[])
          : [];
    if (nextOptions.length < 2) {
      throw new AppError(400, "MCQ needs at least 2 options", "INVALID_MCQ_OPTIONS");
    }
    const nextCorrect =
      input.correctOption !== undefined ? input.correctOption : found.correctOption;
    if (nextCorrect == null || nextCorrect < 0 || nextCorrect >= nextOptions.length) {
      throw new AppError(400, "Valid correct option index required", "INVALID_CORRECT_OPTION");
    }
    options = nextOptions;
    correctOption = nextCorrect;
  } else if (input.type === OnlineQuestionType.SUBJECTIVE) {
    options = Prisma.JsonNull;
    correctOption = null;
  }

  return prisma.onlineExamQuestion.update({
    where: { id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.prompt !== undefined ? { prompt: input.prompt.trim() } : {}),
      ...(options !== undefined ? { options } : {}),
      ...(correctOption !== undefined ? { correctOption } : {}),
      ...(input.marks !== undefined ? { marks: input.marks } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deleteOnlineQuestion(tenantId: string, id: string) {
  const found = await prisma.onlineExamQuestion.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Question not found", "ONLINE_QUESTION_NOT_FOUND");
  await prisma.onlineExamQuestion.delete({ where: { id } });
}

export async function listOnlineAttempts(
  tenantId: string,
  filters?: { examId?: string; studentId?: string; status?: OnlineAttemptStatus },
) {
  return prisma.onlineExamAttempt.findMany({
    where: tenantScope(tenantId, {
      ...(filters?.examId ? { examId: filters.examId } : {}),
      ...(filters?.studentId ? { studentId: filters.studentId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    }),
    include: attemptInclude(),
    orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
    take: 500,
  });
}

export async function startOnlineAttempt(
  tenantId: string,
  input: { examId: string; studentId: string },
  options?: { requirePublished?: boolean },
) {
  const exam = await prisma.onlineExam.findFirst({
    where: tenantScope(tenantId, { id: input.examId, isActive: true }),
    include: { questions: { orderBy: [{ sortOrder: "asc" }] } },
  });
  if (!exam) throw new AppError(404, "Online exam not found", "ONLINE_EXAM_NOT_FOUND");
  if (exam.status === OnlineExamStatus.CLOSED) {
    throw new AppError(400, "Exam is closed", "EXAM_CLOSED");
  }
  if (options?.requirePublished && exam.status !== OnlineExamStatus.PUBLISHED) {
    throw new AppError(400, "Exam is not published", "EXAM_NOT_PUBLISHED");
  }
  const now = new Date();
  if (exam.startsAt && exam.startsAt > now) {
    throw new AppError(400, "Exam has not started yet", "EXAM_NOT_STARTED");
  }
  if (exam.endsAt && exam.endsAt < now) {
    throw new AppError(400, "Exam window has ended", "EXAM_ENDED");
  }

  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: input.studentId }),
    select: { id: true },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");

  const priorCount = await prisma.onlineExamAttempt.count({
    where: tenantScope(tenantId, { examId: exam.id, studentId: student.id }),
  });
  if (priorCount >= exam.maxAttempts) {
    throw new AppError(400, "Max attempts reached", "MAX_ATTEMPTS_REACHED");
  }

  const inProgress = await prisma.onlineExamAttempt.findFirst({
    where: tenantScope(tenantId, {
      examId: exam.id,
      studentId: student.id,
      status: OnlineAttemptStatus.IN_PROGRESS,
    }),
    include: attemptInclude(),
  });
  if (inProgress) return inProgress;

  const maxScore = exam.questions.reduce((sum, q) => sum + q.marks, 0);
  return prisma.onlineExamAttempt.create({
    data: {
      tenantId,
      examId: exam.id,
      studentId: student.id,
      attemptNo: priorCount + 1,
      status: OnlineAttemptStatus.IN_PROGRESS,
      maxScore,
    },
    include: attemptInclude(),
  });
}

export async function submitOnlineAttempt(
  tenantId: string,
  attemptId: string,
  answers: AttemptAnswerInput[],
) {
  const attempt = await prisma.onlineExamAttempt.findFirst({
    where: tenantScope(tenantId, { id: attemptId }),
    include: {
      exam: { include: { questions: true } },
    },
  });
  if (!attempt) throw new AppError(404, "Attempt not found", "ONLINE_ATTEMPT_NOT_FOUND");
  if (attempt.status !== OnlineAttemptStatus.IN_PROGRESS) {
    throw new AppError(400, "Attempt already submitted", "ATTEMPT_ALREADY_SUBMITTED");
  }

  const questionById = new Map(attempt.exam.questions.map((q) => [q.id, q]));
  let autoScore = 0;
  let pendingSubjective = 0;

  await prisma.$transaction(async (tx) => {
    for (const answer of answers) {
      const question = questionById.get(answer.questionId);
      if (!question) continue;

      let marksAwarded: number | null = null;
      let isCorrect: boolean | null = null;

      if (question.type === OnlineQuestionType.MCQ) {
        isCorrect =
          answer.selectedOption != null && answer.selectedOption === question.correctOption;
        marksAwarded = isCorrect ? question.marks : 0;
        autoScore += marksAwarded;
      } else {
        pendingSubjective += 1;
      }

      await tx.onlineExamAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: attempt.id,
            questionId: question.id,
          },
        },
        create: {
          tenantId,
          attemptId: attempt.id,
          questionId: question.id,
          selectedOption: answer.selectedOption ?? null,
          textAnswer: answer.textAnswer?.trim() || null,
          marksAwarded,
          isCorrect,
          gradedAt: marksAwarded != null ? new Date() : null,
        },
        update: {
          selectedOption: answer.selectedOption ?? null,
          textAnswer: answer.textAnswer?.trim() || null,
          marksAwarded,
          isCorrect,
          gradedAt: marksAwarded != null ? new Date() : null,
        },
      });
    }

    const maxScore = attempt.exam.questions.reduce((sum, q) => sum + q.marks, 0);
    await tx.onlineExamAttempt.update({
      where: { id: attempt.id },
      data: {
        status:
          pendingSubjective > 0 ? OnlineAttemptStatus.SUBMITTED : OnlineAttemptStatus.GRADED,
        submittedAt: new Date(),
        score: autoScore,
        maxScore,
      },
    });
  });

  await recalcRanks(tenantId, attempt.examId);
  const refreshed = await prisma.onlineExamAttempt.findFirst({
    where: { id: attempt.id },
    include: attemptInclude(),
  });
  return refreshed!;
}

export async function gradeSubjectiveAnswer(
  tenantId: string,
  answerId: string,
  input: { marksAwarded: number; gradedById?: string },
) {
  const answer = await prisma.onlineExamAnswer.findFirst({
    where: tenantScope(tenantId, { id: answerId }),
    include: {
      question: true,
      attempt: true,
    },
  });
  if (!answer) throw new AppError(404, "Answer not found", "ONLINE_ANSWER_NOT_FOUND");
  if (answer.question.type !== OnlineQuestionType.SUBJECTIVE) {
    throw new AppError(400, "Only subjective answers can be graded", "NOT_SUBJECTIVE");
  }
  if (input.marksAwarded < 0 || input.marksAwarded > answer.question.marks) {
    throw new AppError(400, "Marks out of range", "INVALID_MARKS");
  }

  await prisma.onlineExamAnswer.update({
    where: { id: answer.id },
    data: {
      marksAwarded: input.marksAwarded,
      isCorrect: input.marksAwarded > 0,
      gradedAt: new Date(),
      gradedById: input.gradedById || null,
    },
  });

  const allAnswers = await prisma.onlineExamAnswer.findMany({
    where: tenantScope(tenantId, { attemptId: answer.attemptId }),
    include: { question: { select: { type: true, marks: true } } },
  });
  const score = allAnswers.reduce((sum, row) => sum + num(row.marksAwarded), 0);
  const pending = allAnswers.some(
    (row) => row.question.type === OnlineQuestionType.SUBJECTIVE && row.marksAwarded == null,
  );

  await prisma.onlineExamAttempt.update({
    where: { id: answer.attemptId },
    data: {
      score,
      status: pending ? OnlineAttemptStatus.SUBMITTED : OnlineAttemptStatus.GRADED,
      gradedById: input.gradedById || null,
    },
  });

  await recalcRanks(tenantId, answer.attempt.examId);
  return prisma.onlineExamAttempt.findFirst({
    where: { id: answer.attemptId },
    include: attemptInclude(),
  });
}

export async function listPendingSubjectiveGrades(tenantId: string, examId?: string) {
  const answers = await prisma.onlineExamAnswer.findMany({
    where: tenantScope(tenantId, {
      marksAwarded: null,
      question: { type: OnlineQuestionType.SUBJECTIVE },
      attempt: {
        status: { in: [OnlineAttemptStatus.SUBMITTED, OnlineAttemptStatus.GRADED] },
        ...(examId ? { examId } : {}),
      },
    }),
    include: {
      question: {
        select: {
          id: true,
          type: true,
          prompt: true,
          marks: true,
          sortOrder: true,
        },
      },
      attempt: {
        include: {
          exam: { select: { id: true, title: true, passMarks: true, status: true } },
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return answers.map((answer) => ({
    id: answer.id,
    textAnswer: answer.textAnswer,
    marksAwarded: answer.marksAwarded,
    question: answer.question,
    attempt: {
      id: answer.attempt.id,
      status: answer.attempt.status,
      score: answer.attempt.score,
      maxScore: answer.attempt.maxScore,
      exam: answer.attempt.exam,
      student: answer.attempt.student,
    },
  }));
}

export async function listExamRanks(tenantId: string, examId: string) {
  const exam = await prisma.onlineExam.findFirst({
    where: tenantScope(tenantId, { id: examId }),
    select: { id: true, title: true, passMarks: true },
  });
  if (!exam) throw new AppError(404, "Online exam not found", "ONLINE_EXAM_NOT_FOUND");

  const attempts = await prisma.onlineExamAttempt.findMany({
    where: tenantScope(tenantId, {
      examId,
      status: { in: [OnlineAttemptStatus.SUBMITTED, OnlineAttemptStatus.GRADED] },
    }),
    include: {
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ rank: "asc" }, { score: "desc" }],
    take: 1000,
  });

  return { exam, rows: attempts };
}
