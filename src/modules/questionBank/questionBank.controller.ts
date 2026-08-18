import { QuestionSource, QuestionStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  createCategory,
  createDifficultyLevel,
  createQuestion,
  createQuestionType,
  deleteCategory,
  getQuestionBankDashboardStats,
  getQuestionBankModuleSettings,
  getQuestionById,
  importQuestionsFromCsv,
  buildQuestionBankImportTemplateCsv,
  listCategories,
  listDifficultyLevels,
  listQuestionTypes,
  listQuestions,
  archiveQuestion,
  publishQuestion,
  seedQuestionBankDefaults,
  softDeleteQuestion,
  updateCategory,
  updateQuestion,
  updateQuestionBankModuleSettings,
} from "./questionBank.service.js";

const idParams = z.object({ id: z.string().min(1) });

const optionSchema = z.object({
  optionText: z.string().trim().min(1).max(10000),
  isCorrect: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  mediaUrl: z.string().trim().min(1).max(2000).nullable().optional(),
});

const createBody = z.object({
  subjectId: z.string().min(1),
  classId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  questionTypeId: z.string().min(1),
  difficultyLevelId: z.string().min(1),
  questionText: z.string().trim().min(1).max(50000),
  explanation: z.string().trim().max(50000).nullable().optional(),
  marks: z.coerce.number().min(0).max(1000).optional(),
  negativeMarks: z.coerce.number().min(0).max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  source: z.nativeEnum(QuestionSource).optional(),
  options: z.array(optionSchema).max(50).optional(),
});

const updateBody = createBody.partial().omit({ source: true });

const categoryBody = z.object({
  subjectId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  parentCategoryId: z.string().min(1).nullable().optional(),
});

const updateCategoryBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentCategoryId: z.string().min(1).nullable().optional(),
});

const typeBody = z.object({
  name: z.string().trim().min(1).max(120),
  defaultMarks: z.coerce.number().min(0).max(1000),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

const difficultyBody = z.object({
  name: z.string().trim().min(1).max(120),
  colorTag: z.string().trim().min(1).max(32),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

const settingsBody = z.object({
  allowTeachersToAddQuestions: z.boolean(),
});

const importBody = z.object({
  csv: z.string().min(10).max(2_000_000),
});

const listQuery = z.object({
  subjectId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  questionTypeId: z.string().min(1).optional(),
  difficultyLevelId: z.string().min(1).optional(),
  status: z.nativeEnum(QuestionStatus).optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
  createdById: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

function tenantId(req: Request) {
  const id = req.auth?.tenantId;
  if (!id) throw new AppError(403, "A tenant context is required", "TENANT_REQUIRED");
  return id;
}

export async function listCategoriesController(req: Request, res: Response) {
  const subjectId =
    typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
  res.json({ data: await listCategories(tenantId(req), subjectId) });
}

export async function createCategoryController(req: Request, res: Response) {
  res.status(201).json({
    data: await createCategory(tenantId(req), categoryBody.parse(req.body)),
  });
}

export async function updateCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateCategory(tenantId(req), id, updateCategoryBody.parse(req.body)),
  });
}

export async function deleteCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteCategory(tenantId(req), id);
  res.status(204).send();
}

export async function listQuestionsController(req: Request, res: Response) {
  const query = listQuery.parse(req.query);
  res.json({
    data: await listQuestions(tenantId(req), {
      ...query,
      tags: query.tags
        ? query.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
    }),
  });
}

export async function getQuestionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const question = await getQuestionById(tenantId(req), id);
  if (!question) throw new AppError(404, "Question not found", "QUESTION_NOT_FOUND");
  res.json({ data: question });
}

export async function createQuestionController(req: Request, res: Response) {
  const body = createBody.parse(req.body);
  res.status(201).json({
    data: await createQuestion({
      ...body,
      tenantId: tenantId(req),
      createdById: req.auth!.userId,
    }),
  });
}

export async function importQuestionsController(req: Request, res: Response) {
  const body = importBody.parse(req.body);
  res.json({
    data: await importQuestionsFromCsv({
      tenantId: tenantId(req),
      createdById: req.auth!.userId,
      csvText: body.csv,
    }),
  });
}

export async function downloadImportTemplateController(_req: Request, res: Response) {
  const csv = buildQuestionBankImportTemplateCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="question_bank_import_template.csv"',
  );
  res.send(csv);
}

export async function updateQuestionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateQuestion(id, tenantId(req), updateBody.parse(req.body)),
  });
}

export async function publishQuestionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await publishQuestion(id, tenantId(req), req.auth!.userId),
  });
}

export async function archiveQuestionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await archiveQuestion(id, tenantId(req)) });
}

export async function deleteQuestionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await softDeleteQuestion(id, tenantId(req));
  res.status(204).send();
}

export async function listQuestionTypesController(req: Request, res: Response) {
  res.json({ data: await listQuestionTypes(tenantId(req)) });
}

export async function createQuestionTypeController(req: Request, res: Response) {
  res.status(201).json({
    data: await createQuestionType(tenantId(req), typeBody.parse(req.body)),
  });
}

export async function listDifficultyLevelsController(req: Request, res: Response) {
  res.json({ data: await listDifficultyLevels(tenantId(req)) });
}

export async function createDifficultyLevelController(req: Request, res: Response) {
  res.status(201).json({
    data: await createDifficultyLevel(tenantId(req), difficultyBody.parse(req.body)),
  });
}

export async function getStatsController(req: Request, res: Response) {
  res.json({
    data: await getQuestionBankDashboardStats(tenantId(req), req.auth!.userId),
  });
}

export async function getSettingsController(req: Request, res: Response) {
  res.json({ data: await getQuestionBankModuleSettings(tenantId(req)) });
}

export async function updateSettingsController(req: Request, res: Response) {
  const body = settingsBody.parse(req.body);
  res.json({
    data: await updateQuestionBankModuleSettings(
      tenantId(req),
      body.allowTeachersToAddQuestions,
    ),
  });
}

export async function seedDefaultsController(req: Request, res: Response) {
  res.json({ data: await seedQuestionBankDefaults(tenantId(req)) });
}
