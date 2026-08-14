import { Prisma, QuestionStatus, QuestionUsageContext, TestSeriesStatus } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { logUsage } from "../questionBank/questionBank.service.js";

const seriesInclude = {
  subject: { select: { id: true, name: true, code: true } },
  academicClass: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  papers: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      _count: { select: { questions: true } },
    },
  },
  _count: { select: { papers: true } },
} satisfies Prisma.TestSeriesInclude;

const paperQuestionInclude = {
  question: {
    include: {
      questionType: true,
      difficultyLevel: true,
      category: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
      options: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} satisfies Prisma.TestSeriesPaperQuestionInclude;

const paperInclude = {
  questions: {
    orderBy: { sortOrder: "asc" as const },
    include: paperQuestionInclude,
  },
  _count: { select: { questions: true } },
} satisfies Prisma.TestSeriesPaperInclude;

async function assertSubject(tenantId: string, subjectId: string | null | undefined) {
  if (!subjectId) return;
  const row = await prisma.subject.findFirst({ where: { id: subjectId, tenantId }, select: { id: true } });
  if (!row) throw new AppError(400, "Subject is invalid", "INVALID_SUBJECT");
}

async function assertClass(tenantId: string, classId: string | null | undefined) {
  if (!classId) return;
  const row = await prisma.academicClass.findFirst({ where: { id: classId, tenantId }, select: { id: true } });
  if (!row) throw new AppError(400, "Class is invalid", "INVALID_CLASS");
}

async function getSeriesOrThrow(tenantId: string, seriesId: string) {
  const series = await prisma.testSeries.findFirst({
    where: { id: seriesId, tenantId },
    include: seriesInclude,
  });
  if (!series) throw new AppError(404, "Test series not found", "TEST_SERIES_NOT_FOUND");
  return series;
}

async function getPaperOrThrow(tenantId: string, paperId: string, seriesId?: string) {
  const paper = await prisma.testSeriesPaper.findFirst({
    where: { id: paperId, tenantId, ...(seriesId ? { seriesId } : {}) },
    include: paperInclude,
  });
  if (!paper) throw new AppError(404, "Test paper not found", "TEST_PAPER_NOT_FOUND");
  return paper;
}

function paperTotalMarks(questions: Array<{ marks: Prisma.Decimal }>) {
  return questions.reduce((sum, row) => sum + Number(row.marks), 0);
}

export async function listTestSeries(
  tenantId: string,
  opts: {
    status?: TestSeriesStatus;
    subjectId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const where: Prisma.TestSeriesWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
    ...(opts.search
      ? { name: { contains: opts.search, mode: "insensitive" } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.testSeries.findMany({
      where,
      include: seriesInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testSeries.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getTestSeriesById(tenantId: string, seriesId: string) {
  return getSeriesOrThrow(tenantId, seriesId);
}

export async function createTestSeries(
  tenantId: string,
  createdById: string,
  input: {
    name: string;
    description?: string | null;
    subjectId?: string | null;
    classId?: string | null;
  },
) {
  await assertSubject(tenantId, input.subjectId);
  await assertClass(tenantId, input.classId);

  return prisma.testSeries.create({
    data: {
      tenantId,
      createdById,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      subjectId: input.subjectId || null,
      classId: input.classId || null,
      status: TestSeriesStatus.DRAFT,
    },
    include: seriesInclude,
  });
}

export async function updateTestSeries(
  tenantId: string,
  seriesId: string,
  input: {
    name?: string;
    description?: string | null;
    subjectId?: string | null;
    classId?: string | null;
  },
) {
  await getSeriesOrThrow(tenantId, seriesId);
  if (input.subjectId !== undefined) await assertSubject(tenantId, input.subjectId);
  if (input.classId !== undefined) await assertClass(tenantId, input.classId);

  return prisma.testSeries.update({
    where: { id: seriesId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId || null } : {}),
      ...(input.classId !== undefined ? { classId: input.classId || null } : {}),
    },
    include: seriesInclude,
  });
}

export async function publishTestSeries(tenantId: string, seriesId: string) {
  const series = await getSeriesOrThrow(tenantId, seriesId);
  if (series.status === TestSeriesStatus.ARCHIVED) {
    throw new AppError(400, "Archived test series cannot be published", "INVALID_STATUS");
  }
  return prisma.testSeries.update({
    where: { id: seriesId },
    data: { status: TestSeriesStatus.PUBLISHED },
    include: seriesInclude,
  });
}

export async function archiveTestSeries(tenantId: string, seriesId: string) {
  await getSeriesOrThrow(tenantId, seriesId);
  return prisma.testSeries.update({
    where: { id: seriesId },
    data: { status: TestSeriesStatus.ARCHIVED },
    include: seriesInclude,
  });
}

export async function deleteTestSeries(tenantId: string, seriesId: string) {
  await getSeriesOrThrow(tenantId, seriesId);
  await prisma.testSeries.delete({ where: { id: seriesId } });
  return { ok: true };
}

export async function createPaper(
  tenantId: string,
  seriesId: string,
  input: {
    title: string;
    instructions?: string | null;
    durationMinutes?: number;
    passMarks?: number | null;
    sortOrder?: number;
  },
) {
  await getSeriesOrThrow(tenantId, seriesId);
  const maxSort = await prisma.testSeriesPaper.aggregate({
    where: { tenantId, seriesId },
    _max: { sortOrder: true },
  });

  return prisma.testSeriesPaper.create({
    data: {
      tenantId,
      seriesId,
      title: input.title.trim(),
      instructions: input.instructions?.trim() || null,
      durationMinutes: input.durationMinutes ?? 60,
      passMarks: input.passMarks ?? null,
      sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
      status: TestSeriesStatus.DRAFT,
    },
    include: paperInclude,
  });
}

export async function updatePaper(
  tenantId: string,
  seriesId: string,
  paperId: string,
  input: {
    title?: string;
    instructions?: string | null;
    durationMinutes?: number;
    passMarks?: number | null;
    sortOrder?: number;
  },
) {
  await getPaperOrThrow(tenantId, paperId, seriesId);
  return prisma.testSeriesPaper.update({
    where: { id: paperId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.instructions !== undefined ? { instructions: input.instructions?.trim() || null } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.passMarks !== undefined ? { passMarks: input.passMarks } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    include: paperInclude,
  });
}

export async function publishPaper(tenantId: string, seriesId: string, paperId: string) {
  const paper = await getPaperOrThrow(tenantId, paperId, seriesId);
  if (paper.status === TestSeriesStatus.ARCHIVED) {
    throw new AppError(400, "Archived papers cannot be published", "INVALID_STATUS");
  }
  if (!paper.questions.length) {
    throw new AppError(400, "Cannot publish a paper with no questions", "EMPTY_PAPER");
  }
  return prisma.testSeriesPaper.update({
    where: { id: paperId },
    data: { status: TestSeriesStatus.PUBLISHED },
    include: paperInclude,
  });
}

export async function archivePaper(tenantId: string, seriesId: string, paperId: string) {
  await getPaperOrThrow(tenantId, paperId, seriesId);
  return prisma.testSeriesPaper.update({
    where: { id: paperId },
    data: { status: TestSeriesStatus.ARCHIVED },
    include: paperInclude,
  });
}

export async function deletePaper(tenantId: string, seriesId: string, paperId: string) {
  await getPaperOrThrow(tenantId, paperId, seriesId);
  await prisma.testSeriesPaper.delete({ where: { id: paperId } });
  return { ok: true };
}

export async function getPaper(tenantId: string, seriesId: string, paperId: string) {
  const paper = await getPaperOrThrow(tenantId, paperId, seriesId);
  return {
    ...paper,
    totalMarks: paperTotalMarks(paper.questions),
  };
}

/** Attach specific published bank questions to a paper (no content copy). */
export async function addQuestionsByIds(
  tenantId: string,
  seriesId: string,
  paperId: string,
  questionIds: string[],
) {
  const paper = await getPaperOrThrow(tenantId, paperId, seriesId);
  const uniqueIds = [...new Set(questionIds)];
  if (!uniqueIds.length) throw new AppError(400, "Select at least one question", "EMPTY_QUESTION_IDS");

  const bankQuestions = await prisma.question.findMany({
    where: {
      tenantId,
      id: { in: uniqueIds },
      deletedAt: null,
      status: QuestionStatus.PUBLISHED,
    },
  });
  if (bankQuestions.length !== uniqueIds.length) {
    throw new AppError(
      400,
      "One or more questions are missing, deleted, or not published",
      "INVALID_BANK_QUESTIONS",
    );
  }

  const existing = await prisma.testSeriesPaperQuestion.findMany({
    where: { paperId, questionId: { in: uniqueIds } },
    select: { questionId: true },
  });
  const existingSet = new Set(existing.map((row) => row.questionId));
  const toAdd = bankQuestions.filter((q) => !existingSet.has(q.id));
  if (!toAdd.length) {
    return getPaper(tenantId, seriesId, paperId);
  }

  const maxSort = await prisma.testSeriesPaperQuestion.aggregate({
    where: { paperId },
    _max: { sortOrder: true },
  });
  let sortOrder = maxSort._max.sortOrder ?? 0;

  await prisma.testSeriesPaperQuestion.createMany({
    data: toAdd.map((q) => {
      sortOrder += 1;
      return {
        tenantId,
        paperId,
        questionId: q.id,
        sortOrder,
        marks: q.marks,
      };
    }),
  });

  await Promise.all(
    toAdd.map((q) => logUsage(q.id, QuestionUsageContext.TEST_SERIES, paper.id)),
  );

  return getPaper(tenantId, seriesId, paperId);
}

/**
 * Pull N published Question Bank items by filter into the paper.
 * Does not duplicate question text — stores FK links only.
 */
export async function pullQuestionsFromBank(
  tenantId: string,
  seriesId: string,
  paperId: string,
  filter: {
    count: number;
    subjectId?: string;
    classId?: string;
    categoryId?: string;
    difficultyLevelId?: string;
    questionTypeId?: string;
    tags?: string[];
  },
) {
  const paper = await getPaperOrThrow(tenantId, paperId, seriesId);
  const count = Math.min(Math.max(filter.count, 1), 100);

  const alreadyLinked = await prisma.testSeriesPaperQuestion.findMany({
    where: { paperId },
    select: { questionId: true },
  });
  const excludeIds = alreadyLinked.map((row) => row.questionId);

  const candidates = await prisma.question.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: QuestionStatus.PUBLISHED,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
      ...(filter.classId ? { classId: filter.classId } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(filter.difficultyLevelId ? { difficultyLevelId: filter.difficultyLevelId } : {}),
      ...(filter.questionTypeId ? { questionTypeId: filter.questionTypeId } : {}),
      ...(filter.tags?.length ? { tags: { hasSome: filter.tags } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: count * 3,
  });

  if (!candidates.length) {
    throw new AppError(
      404,
      "No published Question Bank questions match this filter",
      "NO_MATCHING_QUESTIONS",
    );
  }

  // Shuffle then take `count` for variety across pulls.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const picked = candidates.slice(0, Math.min(count, candidates.length));

  return addQuestionsByIds(
    tenantId,
    seriesId,
    paper.id,
    picked.map((q) => q.id),
  );
}

export async function removePaperQuestion(
  tenantId: string,
  seriesId: string,
  paperId: string,
  linkId: string,
) {
  await getPaperOrThrow(tenantId, paperId, seriesId);
  const link = await prisma.testSeriesPaperQuestion.findFirst({
    where: { id: linkId, tenantId, paperId },
  });
  if (!link) throw new AppError(404, "Paper question not found", "PAPER_QUESTION_NOT_FOUND");
  await prisma.testSeriesPaperQuestion.delete({ where: { id: linkId } });
  return getPaper(tenantId, seriesId, paperId);
}

export async function reorderPaperQuestions(
  tenantId: string,
  seriesId: string,
  paperId: string,
  orderedLinkIds: string[],
) {
  await getPaperOrThrow(tenantId, paperId, seriesId);
  const links = await prisma.testSeriesPaperQuestion.findMany({
    where: { paperId, tenantId },
    select: { id: true },
  });
  const valid = new Set(links.map((row) => row.id));
  if (orderedLinkIds.some((id) => !valid.has(id)) || orderedLinkIds.length !== links.length) {
    throw new AppError(400, "Invalid question order payload", "INVALID_QUESTION_ORDER");
  }

  await prisma.$transaction(
    orderedLinkIds.map((id, index) =>
      prisma.testSeriesPaperQuestion.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  return getPaper(tenantId, seriesId, paperId);
}

export async function updatePaperQuestionMarks(
  tenantId: string,
  seriesId: string,
  paperId: string,
  linkId: string,
  marks: number,
) {
  const paper = await getPaperOrThrow(tenantId, paperId, seriesId);
  if (paper.status !== TestSeriesStatus.DRAFT) {
    throw new AppError(
      403,
      "Marks on published or archived papers can only be changed by republishing flow / admin edit of a draft",
      "PAPER_NOT_DRAFT",
    );
  }
  if (marks < 0 || marks > 1000) {
    throw new AppError(400, "Marks must be between 0 and 1000", "INVALID_MARKS");
  }

  const link = await prisma.testSeriesPaperQuestion.findFirst({
    where: { id: linkId, tenantId, paperId },
  });
  if (!link) throw new AppError(404, "Paper question not found", "PAPER_QUESTION_NOT_FOUND");

  await prisma.testSeriesPaperQuestion.update({
    where: { id: linkId },
    data: { marks },
  });
  return getPaper(tenantId, seriesId, paperId);
}

export async function getTestSeriesModuleSettings(tenantId: string) {
  return prisma.tenantTestSeriesSetting.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      allowTeachersToCreateTestSeries: false,
    },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateTestSeries: true,
      updatedAt: true,
    },
  });
}

export async function updateTestSeriesModuleSettings(
  tenantId: string,
  allowTeachersToCreateTestSeries: boolean,
) {
  await getTestSeriesModuleSettings(tenantId);
  return prisma.tenantTestSeriesSetting.update({
    where: { tenantId },
    data: { allowTeachersToCreateTestSeries },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateTestSeries: true,
      updatedAt: true,
    },
  });
}
