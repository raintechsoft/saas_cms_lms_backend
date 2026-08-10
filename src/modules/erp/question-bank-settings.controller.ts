import {
  NegativeMarkingApplyTo,
  QuestionBankScope,
  QuestionDifficultyLevel,
} from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  QUESTION_TYPE_KEYS,
  deleteDifficultyRule,
  getQuestionBankSettings,
  updateQuestionBankSettings,
  upsertDifficultyRule,
} from "./question-bank-settings.service.js";

const idParams = z.object({ id: z.string().min(1) });

const marksSchema = z.object(
  Object.fromEntries(
    QUESTION_TYPE_KEYS.map((key) => [key, z.coerce.number().min(0).max(1000).optional()]),
  ) as Record<(typeof QUESTION_TYPE_KEYS)[number], z.ZodOptional<z.ZodNumber>>,
);

const settingsBody = z.object({
  scope: z.nativeEnum(QuestionBankScope).optional(),
  enabledQuestionTypes: z.array(z.string().min(1)).max(20).optional(),
  showQuestionMarks: z.boolean().optional(),
  enabledDifficulties: z.array(z.nativeEnum(QuestionDifficultyLevel)).max(3).optional(),
  autoQuestionCode: z.boolean().optional(),
  defaultMarks: marksSchema.optional(),
  negativeMarkingEnabled: z.boolean().optional(),
  negativeMarks: z.coerce.number().min(0).max(100).optional(),
  negativeApplyTo: z.nativeEnum(NegativeMarkingApplyTo).optional(),
  preventDuplicates: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  allowImport: z.boolean().optional(),
  allowExport: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
});

const difficultyBody = z.object({
  id: z.string().min(1).optional(),
  level: z.nativeEnum(QuestionDifficultyLevel),
  fromPercent: z.coerce.number().int().min(0).max(100),
  toPercent: z.coerce.number().int().min(0).max(100),
  description: z.string().trim().max(240).nullable().optional(),
});

export async function getQuestionBankSettingsController(req: Request, res: Response) {
  res.json({ data: await getQuestionBankSettings(req.auth!.tenantId!) });
}

export async function updateQuestionBankSettingsController(req: Request, res: Response) {
  res.json({
    data: await updateQuestionBankSettings(
      req.auth!.tenantId!,
      settingsBody.parse(req.body),
    ),
  });
}

export async function upsertQuestionBankDifficultyController(req: Request, res: Response) {
  res.json({
    data: await upsertDifficultyRule(req.auth!.tenantId!, difficultyBody.parse(req.body)),
  });
}

export async function deleteQuestionBankDifficultyController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteDifficultyRule(req.auth!.tenantId!, id) });
}
