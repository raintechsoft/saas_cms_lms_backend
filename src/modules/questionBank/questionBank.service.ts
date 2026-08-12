import {
  Prisma,
  QuestionSource,
  QuestionStatus,
  QuestionUsageContext,
  type Question,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export type QuestionOptionInput = {
  optionText: string;
  isCorrect: boolean;
  sortOrder?: number;
  mediaUrl?: string | null;
};

export type CreateQuestionInput = {
  tenantId: string;
  subjectId: string;
  classId?: string | null;
  categoryId?: string | null;
  questionTypeId: string;
  difficultyLevelId: string;
  questionText: string;
  explanation?: string | null;
  marks?: number;
  negativeMarks?: number | null;
  tags?: string[];
  source?: QuestionSource;
  createdById: string;
  options?: QuestionOptionInput[];
};

export type UpdateQuestionInput = Partial<
  Omit<CreateQuestionInput, "tenantId" | "createdById" | "source">
> & {
  options?: QuestionOptionInput[];
};

async function assertSubjectInTenant(tenantId: string, subjectId: string) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, tenantId },
    select: { id: true },
  });
  if (!subject) throw new AppError(400, "Subject is invalid", "INVALID_SUBJECT");
}

async function assertTypeAndDifficulty(
  tenantId: string,
  questionTypeId: string,
  difficultyLevelId: string,
) {
  const [typeConfig, difficulty] = await Promise.all([
    prisma.questionTypeConfig.findFirst({
      where: { id: questionTypeId, tenantId, isActive: true },
    }),
    prisma.difficultyLevelConfig.findFirst({
      where: { id: difficultyLevelId, tenantId, isActive: true },
    }),
  ]);
  if (!typeConfig) throw new AppError(400, "Question type is invalid", "INVALID_QUESTION_TYPE");
  if (!difficulty) {
    throw new AppError(400, "Difficulty level is invalid", "INVALID_DIFFICULTY");
  }
  return typeConfig;
}

async function assertClassInTenant(tenantId: string, classId: string | null | undefined) {
  if (!classId) return;
  const row = await prisma.academicClass.findFirst({
    where: { id: classId, tenantId },
    select: { id: true },
  });
  if (!row) throw new AppError(400, "Class is invalid", "INVALID_CLASS");
}

async function assertCategoryInTenant(
  tenantId: string,
  categoryId: string | null | undefined,
  subjectId?: string,
) {
  if (!categoryId) return;
  const row = await prisma.questionCategory.findFirst({
    where: {
      id: categoryId,
      tenantId,
      ...(subjectId ? { subjectId } : {}),
    },
    select: { id: true },
  });
  if (!row) throw new AppError(400, "Category is invalid", "INVALID_CATEGORY");
}

/** Choice-style types that must ship with at least one correct option. */
function typeRequiresOptions(typeName: string) {
  return /mcq|true\s*\/?\s*false|multiple\s*choice|matching/i.test(typeName);
}

function assertOptionsForType(
  typeName: string,
  options: QuestionOptionInput[] | undefined,
  mode: "create" | "publish",
) {
  if (!typeRequiresOptions(typeName)) return;
  const list = options ?? [];
  if (list.length < 2) {
    throw new AppError(
      400,
      `${typeName} questions need at least two options`,
      "OPTIONS_REQUIRED",
    );
  }
  if (!list.some((option) => option.isCorrect)) {
    throw new AppError(
      400,
      mode === "publish"
        ? "Cannot publish: mark at least one option as correct"
        : "Mark at least one option as correct",
      "CORRECT_OPTION_REQUIRED",
    );
  }
}

export const DEFAULT_QUESTION_TYPES: Array<{ name: string; defaultMarks: number; sortOrder: number }> = [
  { name: "MCQ (Single Correct)", defaultMarks: 1, sortOrder: 1 },
  { name: "MCQ (Multiple Correct)", defaultMarks: 1, sortOrder: 2 },
  { name: "True / False", defaultMarks: 1, sortOrder: 3 },
  { name: "Short Answer", defaultMarks: 2, sortOrder: 4 },
  { name: "Long Answer", defaultMarks: 5, sortOrder: 5 },
  { name: "Fill in the Blanks", defaultMarks: 1, sortOrder: 6 },
];

export const DEFAULT_DIFFICULTY_LEVELS: Array<{ name: string; colorTag: string; sortOrder: number }> = [
  { name: "Easy", colorTag: "#22C55E", sortOrder: 1 },
  { name: "Medium", colorTag: "#F59E0B", sortOrder: 2 },
  { name: "Hard", colorTag: "#EF4444", sortOrder: 3 },
];

/**
 * Idempotent seed of tenant question types + difficulty levels.
 * Safe to call when Super Admin enables Question Bank or from ERP "Seed Defaults".
 */
export async function seedQuestionBankDefaults(
  tenantId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const [existingTypes, existingLevels] = await Promise.all([
    client.questionTypeConfig.findMany({
      where: { tenantId },
      select: { name: true },
    }),
    client.difficultyLevelConfig.findMany({
      where: { tenantId },
      select: { name: true },
    }),
  ]);
  const typeNames = new Set(existingTypes.map((row) => row.name.toLowerCase()));
  const levelNames = new Set(existingLevels.map((row) => row.name.toLowerCase()));

  const typesToCreate = DEFAULT_QUESTION_TYPES.filter(
    (row) => !typeNames.has(row.name.toLowerCase()),
  );
  const levelsToCreate = DEFAULT_DIFFICULTY_LEVELS.filter(
    (row) => !levelNames.has(row.name.toLowerCase()),
  );

  if (typesToCreate.length) {
    await client.questionTypeConfig.createMany({
      data: typesToCreate.map((row) => ({
        tenantId,
        name: row.name,
        defaultMarks: row.defaultMarks,
        sortOrder: row.sortOrder,
        isActive: true,
      })),
    });
  }
  if (levelsToCreate.length) {
    await client.difficultyLevelConfig.createMany({
      data: levelsToCreate.map((row) => ({
        tenantId,
        name: row.name,
        colorTag: row.colorTag,
        sortOrder: row.sortOrder,
        isActive: true,
      })),
    });
  }

  const [questionTypes, difficultyLevels] = await Promise.all([
    client.questionTypeConfig.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    client.difficultyLevelConfig.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return {
    seeded: {
      questionTypes: typesToCreate.length,
      difficultyLevels: levelsToCreate.length,
    },
    questionTypes,
    difficultyLevels,
  };
}

async function ensureDefaultsIfEmpty(tenantId: string) {
  const [typeCount, levelCount] = await Promise.all([
    prisma.questionTypeConfig.count({ where: { tenantId } }),
    prisma.difficultyLevelConfig.count({ where: { tenantId } }),
  ]);
  if (typeCount === 0 || levelCount === 0) {
    await seedQuestionBankDefaults(tenantId);
  }
}

export async function listCategories(tenantId: string, subjectId?: string) {
  return prisma.questionCategory.findMany({
    where: {
      tenantId,
      parentCategoryId: null,
      ...(subjectId ? { subjectId } : {}),
    },
    include: {
      subCategories: { orderBy: { name: "asc" } },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(
  tenantId: string,
  input: { subjectId: string; name: string; parentCategoryId?: string | null },
) {
  await assertSubjectInTenant(tenantId, input.subjectId);
  if (input.parentCategoryId) {
    const parent = await prisma.questionCategory.findFirst({
      where: {
        id: input.parentCategoryId,
        tenantId,
        subjectId: input.subjectId,
      },
    });
    if (!parent) throw new AppError(400, "Parent category is invalid", "INVALID_PARENT_CATEGORY");
  }

  return prisma.questionCategory.create({
    data: {
      tenantId,
      subjectId: input.subjectId,
      name: input.name.trim(),
      parentCategoryId: input.parentCategoryId ?? null,
    },
    include: {
      subCategories: { orderBy: { name: "asc" } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function updateCategory(
  tenantId: string,
  id: string,
  input: { name?: string; parentCategoryId?: string | null },
) {
  const existing = await prisma.questionCategory.findFirst({
    where: { id, tenantId },
  });
  if (!existing) throw new AppError(404, "Category not found", "CATEGORY_NOT_FOUND");

  const name = input.name?.trim() ?? existing.name;
  if (!name) throw new AppError(400, "Category name is required", "INVALID_CATEGORY_NAME");

  const parentCategoryId =
    input.parentCategoryId !== undefined ? input.parentCategoryId : existing.parentCategoryId;

  if (parentCategoryId) {
    if (parentCategoryId === id) {
      throw new AppError(400, "Category cannot be its own parent", "INVALID_PARENT_CATEGORY");
    }
    const parent = await prisma.questionCategory.findFirst({
      where: {
        id: parentCategoryId,
        tenantId,
        subjectId: existing.subjectId,
      },
    });
    if (!parent) throw new AppError(400, "Parent category is invalid", "INVALID_PARENT_CATEGORY");
  }

  return prisma.questionCategory.update({
    where: { id },
    data: { name, parentCategoryId },
    include: {
      subCategories: { orderBy: { name: "asc" } },
      subject: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function deleteCategory(tenantId: string, id: string) {
  const existing = await prisma.questionCategory.findFirst({
    where: { id, tenantId },
    include: {
      _count: { select: { questions: true, subCategories: true } },
    },
  });
  if (!existing) throw new AppError(404, "Category not found", "CATEGORY_NOT_FOUND");
  if (existing._count.questions > 0) {
    throw new AppError(
      409,
      "This category has questions assigned. Reassign or remove them first.",
      "CATEGORY_IN_USE",
    );
  }
  if (existing._count.subCategories > 0) {
    throw new AppError(
      409,
      "Delete subcategories before removing this category.",
      "CATEGORY_HAS_CHILDREN",
    );
  }

  await prisma.questionCategory.delete({ where: { id } });
}

export async function listQuestions(
  tenantId: string,
  filters: {
    subjectId?: string;
    classId?: string;
    categoryId?: string;
    questionTypeId?: string;
    difficultyLevelId?: string;
    status?: QuestionStatus;
    search?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  },
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const search = filters.search?.trim();

  const where: Prisma.QuestionWhereInput = {
    tenantId,
    deletedAt: null,
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.classId ? { classId: filters.classId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.questionTypeId ? { questionTypeId: filters.questionTypeId } : {}),
    ...(filters.difficultyLevelId ? { difficultyLevelId: filters.difficultyLevelId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(search
      ? { questionText: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(filters.tags?.length ? { tags: { hasSome: filters.tags } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        media: true,
        questionType: true,
        difficultyLevel: true,
        category: true,
        subject: { select: { id: true, name: true, code: true } },
        academicClass: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.question.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getQuestionById(tenantId: string, id: string) {
  return prisma.question.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      media: true,
      questionType: true,
      difficultyLevel: true,
      category: true,
      subject: { select: { id: true, name: true, code: true } },
      academicClass: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function createQuestion(input: CreateQuestionInput) {
  await assertSubjectInTenant(input.tenantId, input.subjectId);
  const typeConfig = await assertTypeAndDifficulty(
    input.tenantId,
    input.questionTypeId,
    input.difficultyLevelId,
  );
  await assertClassInTenant(input.tenantId, input.classId);
  await assertCategoryInTenant(input.tenantId, input.categoryId, input.subjectId);
  assertOptionsForType(typeConfig.name, input.options, "create");

  const marks =
    input.marks !== undefined && input.marks !== null
      ? input.marks
      : Number(typeConfig.defaultMarks);

  return prisma.question.create({
    data: {
      tenantId: input.tenantId,
      subjectId: input.subjectId,
      classId: input.classId ?? null,
      categoryId: input.categoryId ?? null,
      questionTypeId: input.questionTypeId,
      difficultyLevelId: input.difficultyLevelId,
      questionText: input.questionText.trim(),
      explanation: input.explanation?.trim() || null,
      marks,
      negativeMarks: input.negativeMarks ?? null,
      tags: input.tags ?? [],
      source: input.source ?? QuestionSource.MANUAL,
      createdById: input.createdById,
      status: QuestionStatus.DRAFT,
      options: input.options?.length
        ? {
            create: input.options.map((option, idx) => ({
              optionText: option.optionText.trim(),
              isCorrect: option.isCorrect,
              sortOrder: option.sortOrder ?? idx,
              mediaUrl: option.mediaUrl ?? null,
            })),
          }
        : undefined,
    },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      media: true,
      questionType: true,
      difficultyLevel: true,
      category: true,
    },
  });
}

export async function updateQuestion(
  id: string,
  tenantId: string,
  data: UpdateQuestionInput,
): Promise<Question> {
  const existing = await prisma.question.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) throw new AppError(404, "Question not found", "QUESTION_NOT_FOUND");

  const nextSubjectId = data.subjectId ?? existing.subjectId;
  if (data.subjectId) await assertSubjectInTenant(tenantId, data.subjectId);
  const typeConfig =
    data.questionTypeId || data.difficultyLevelId || data.options
      ? await assertTypeAndDifficulty(
          tenantId,
          data.questionTypeId ?? existing.questionTypeId,
          data.difficultyLevelId ?? existing.difficultyLevelId,
        )
      : null;
  if (data.classId !== undefined) await assertClassInTenant(tenantId, data.classId);
  if (data.categoryId !== undefined) {
    await assertCategoryInTenant(tenantId, data.categoryId, nextSubjectId);
  }
  if (data.options && typeConfig) {
    assertOptionsForType(typeConfig.name, data.options, "create");
  }

  return prisma.$transaction(async (tx) => {
    if (data.options) {
      await tx.questionOption.deleteMany({ where: { questionId: id } });
      if (data.options.length) {
        await tx.questionOption.createMany({
          data: data.options.map((option, idx) => ({
            questionId: id,
            optionText: option.optionText.trim(),
            isCorrect: option.isCorrect,
            sortOrder: option.sortOrder ?? idx,
            mediaUrl: option.mediaUrl ?? null,
          })),
        });
      }
    }

    return tx.question.update({
      where: { id },
      data: {
        subjectId: data.subjectId,
        classId: data.classId === undefined ? undefined : data.classId,
        categoryId: data.categoryId === undefined ? undefined : data.categoryId,
        questionTypeId: data.questionTypeId,
        difficultyLevelId: data.difficultyLevelId,
        questionText: data.questionText?.trim(),
        explanation:
          data.explanation === undefined ? undefined : data.explanation?.trim() || null,
        marks: data.marks,
        negativeMarks: data.negativeMarks === undefined ? undefined : data.negativeMarks,
        tags: data.tags,
      },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        media: true,
        questionType: true,
        difficultyLevel: true,
        category: true,
      },
    });
  });
}

export async function publishQuestion(id: string, tenantId: string, reviewedById: string) {
  const existing = await prisma.question.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      options: true,
      questionType: true,
    },
  });
  if (!existing) throw new AppError(404, "Question not found", "QUESTION_NOT_FOUND");
  if (existing.status === QuestionStatus.ARCHIVED) {
    throw new AppError(400, "Archived questions cannot be published", "INVALID_STATUS");
  }
  if (Number(existing.marks) <= 0) {
    throw new AppError(400, "Cannot publish a question with zero marks", "MARKS_REQUIRED");
  }
  if (!existing.questionText.trim()) {
    throw new AppError(400, "Cannot publish an empty question", "QUESTION_TEXT_REQUIRED");
  }
  assertOptionsForType(
    existing.questionType.name,
    existing.options.map((option) => ({
      optionText: option.optionText,
      isCorrect: option.isCorrect,
      sortOrder: option.sortOrder,
      mediaUrl: option.mediaUrl,
    })),
    "publish",
  );

  return prisma.question.update({
    where: { id },
    data: { status: QuestionStatus.PUBLISHED, reviewedById },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      questionType: true,
      difficultyLevel: true,
    },
  });
}

export async function archiveQuestion(id: string, tenantId: string) {
  const existing = await prisma.question.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) throw new AppError(404, "Question not found", "QUESTION_NOT_FOUND");

  return prisma.question.update({
    where: { id },
    data: { status: QuestionStatus.ARCHIVED },
  });
}

export async function softDeleteQuestion(id: string, tenantId: string) {
  const existing = await prisma.question.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!existing) throw new AppError(404, "Question not found", "QUESTION_NOT_FOUND");

  await prisma.question.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function logUsage(
  questionId: string,
  context: QuestionUsageContext,
  refId: string,
) {
  return prisma.questionUsageLog.create({
    data: { questionId, context, refId },
  });
}

export async function listQuestionTypes(tenantId: string, includeInactive = false) {
  await ensureDefaultsIfEmpty(tenantId);
  return prisma.questionTypeConfig.findMany({
    where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createQuestionType(
  tenantId: string,
  input: { name: string; defaultMarks: number; sortOrder?: number },
) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, "Name is required", "NAME_REQUIRED");
  if (input.defaultMarks < 0 || input.defaultMarks > 1000) {
    throw new AppError(400, "Default marks must be between 0 and 1000", "INVALID_MARKS");
  }

  try {
    return await prisma.questionTypeConfig.create({
      data: {
        tenantId,
        name,
        defaultMarks: input.defaultMarks,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "Question type already exists", "DUPLICATE_QUESTION_TYPE");
    }
    throw error;
  }
}

export async function listDifficultyLevels(tenantId: string, includeInactive = false) {
  await ensureDefaultsIfEmpty(tenantId);
  return prisma.difficultyLevelConfig.findMany({
    where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createDifficultyLevel(
  tenantId: string,
  input: { name: string; colorTag: string; sortOrder?: number },
) {
  const name = input.name.trim();
  const colorTag = input.colorTag.trim();
  if (!name) throw new AppError(400, "Name is required", "NAME_REQUIRED");
  if (!colorTag) throw new AppError(400, "Color tag is required", "COLOR_REQUIRED");

  try {
    return await prisma.difficultyLevelConfig.create({
      data: {
        tenantId,
        name,
        colorTag,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "Difficulty level already exists", "DUPLICATE_DIFFICULTY");
    }
    throw error;
  }
}

export async function getQuestionBankModuleSettings(tenantId: string) {
  await ensureDefaultsIfEmpty(tenantId);
  return prisma.tenantQuestionBankSetting.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      defaultMarks: {
        MCQ_SINGLE: 1,
        MCQ_MULTI: 1,
        TRUE_FALSE: 1,
        SHORT_ANSWER: 2,
        LONG_ANSWER: 5,
        FILL_BLANKS: 1,
        MATCHING: 1,
      },
      allowTeachersToAddQuestions: false,
    },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToAddQuestions: true,
      requireApproval: true,
      updatedAt: true,
    },
  });
}

export async function updateQuestionBankModuleSettings(
  tenantId: string,
  allowTeachersToAddQuestions: boolean,
) {
  await getQuestionBankModuleSettings(tenantId);
  return prisma.tenantQuestionBankSetting.update({
    where: { tenantId },
    data: { allowTeachersToAddQuestions },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToAddQuestions: true,
      requireApproval: true,
      updatedAt: true,
    },
  });
}
