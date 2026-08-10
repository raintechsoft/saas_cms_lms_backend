import {
  NegativeMarkingApplyTo,
  Prisma,
  QuestionBankScope,
  QuestionDifficultyLevel,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export const QUESTION_TYPE_KEYS = [
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "FILL_BLANKS",
  "MATCHING",
] as const;

export type QuestionTypeKey = (typeof QUESTION_TYPE_KEYS)[number];

const DEFAULT_MARKS: Record<QuestionTypeKey, number> = {
  MCQ_SINGLE: 1,
  MCQ_MULTI: 1,
  TRUE_FALSE: 1,
  SHORT_ANSWER: 2,
  LONG_ANSWER: 5,
  FILL_BLANKS: 1,
  MATCHING: 1,
};

const DEFAULT_TYPES: QuestionTypeKey[] = [
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "FILL_BLANKS",
];

const DEFAULT_DIFFICULTY_RULES: Array<{
  level: QuestionDifficultyLevel;
  fromPercent: number;
  toPercent: number;
  description: string;
  sortOrder: number;
}> = [
  {
    level: QuestionDifficultyLevel.EASY,
    fromPercent: 71,
    toPercent: 100,
    description: "Most students answer correctly",
    sortOrder: 1,
  },
  {
    level: QuestionDifficultyLevel.MEDIUM,
    fromPercent: 41,
    toPercent: 70,
    description: "Some students find challenging",
    sortOrder: 2,
  },
  {
    level: QuestionDifficultyLevel.HARD,
    fromPercent: 0,
    toPercent: 40,
    description: "Most students find difficult",
    sortOrder: 3,
  },
];

function parseDefaultMarks(value: Prisma.JsonValue | null | undefined) {
  const base = { ...DEFAULT_MARKS };
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  for (const key of QUESTION_TYPE_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      base[key] = raw;
    }
  }
  return base;
}

function normalizeTypes(types?: string[]) {
  if (!types) return DEFAULT_TYPES;
  const filtered = QUESTION_TYPE_KEYS.filter((key) => types.includes(key));
  if (!filtered.length) {
    throw new AppError(400, "Select at least one question type", "QUESTION_TYPE_REQUIRED");
  }
  return filtered;
}

function normalizeDifficulties(levels?: QuestionDifficultyLevel[]) {
  if (!levels) {
    return [
      QuestionDifficultyLevel.EASY,
      QuestionDifficultyLevel.MEDIUM,
      QuestionDifficultyLevel.HARD,
    ];
  }
  const unique = [...new Set(levels)];
  if (!unique.length) {
    throw new AppError(400, "Select at least one difficulty level", "DIFFICULTY_REQUIRED");
  }
  return unique;
}

function mapSetting(setting: {
  id: string;
  scope: QuestionBankScope;
  enabledQuestionTypes: string[];
  showQuestionMarks: boolean;
  enabledDifficulties: QuestionDifficultyLevel[];
  autoQuestionCode: boolean;
  defaultMarks: Prisma.JsonValue;
  negativeMarkingEnabled: boolean;
  negativeMarks: Prisma.Decimal;
  negativeApplyTo: NegativeMarkingApplyTo;
  preventDuplicates: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowImport: boolean;
  allowExport: boolean;
  requireApproval: boolean;
  difficultyRules: Array<{
    id: string;
    level: QuestionDifficultyLevel;
    fromPercent: number;
    toPercent: number;
    description: string | null;
    sortOrder: number;
  }>;
}) {
  return {
    id: setting.id,
    scope: setting.scope,
    enabledQuestionTypes: setting.enabledQuestionTypes,
    showQuestionMarks: setting.showQuestionMarks,
    enabledDifficulties: setting.enabledDifficulties,
    autoQuestionCode: setting.autoQuestionCode,
    defaultMarks: parseDefaultMarks(setting.defaultMarks),
    negativeMarkingEnabled: setting.negativeMarkingEnabled,
    negativeMarks: Number(setting.negativeMarks),
    negativeApplyTo: setting.negativeApplyTo,
    preventDuplicates: setting.preventDuplicates,
    shuffleQuestions: setting.shuffleQuestions,
    shuffleOptions: setting.shuffleOptions,
    allowImport: setting.allowImport,
    allowExport: setting.allowExport,
    requireApproval: setting.requireApproval,
    difficultyRules: setting.difficultyRules.map((rule) => ({
      id: rule.id,
      level: rule.level,
      fromPercent: rule.fromPercent,
      toPercent: rule.toPercent,
      description: rule.description,
      sortOrder: rule.sortOrder,
    })),
  };
}

async function ensureSetting(tenantId: string) {
  const existing = await prisma.tenantQuestionBankSetting.findUnique({
    where: { tenantId },
    include: {
      difficultyRules: { orderBy: [{ sortOrder: "asc" }, { level: "asc" }] },
    },
  });
  if (existing) return existing;

  return prisma.tenantQuestionBankSetting.create({
    data: {
      tenantId,
      scope: QuestionBankScope.GLOBAL,
      enabledQuestionTypes: DEFAULT_TYPES,
      showQuestionMarks: true,
      enabledDifficulties: [
        QuestionDifficultyLevel.EASY,
        QuestionDifficultyLevel.MEDIUM,
        QuestionDifficultyLevel.HARD,
      ],
      autoQuestionCode: true,
      defaultMarks: DEFAULT_MARKS,
      negativeMarkingEnabled: true,
      negativeMarks: 0.25,
      negativeApplyTo: NegativeMarkingApplyTo.ALL,
      preventDuplicates: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowImport: true,
      allowExport: true,
      requireApproval: false,
      difficultyRules: {
        create: DEFAULT_DIFFICULTY_RULES.map((rule) => ({
          tenantId,
          level: rule.level,
          fromPercent: rule.fromPercent,
          toPercent: rule.toPercent,
          description: rule.description,
          sortOrder: rule.sortOrder,
        })),
      },
    },
    include: {
      difficultyRules: { orderBy: [{ sortOrder: "asc" }, { level: "asc" }] },
    },
  });
}

export async function getQuestionBankSettings(tenantId: string) {
  const setting = await ensureSetting(tenantId);
  return mapSetting(setting);
}

export async function updateQuestionBankSettings(
  tenantId: string,
  input: {
    scope?: QuestionBankScope;
    enabledQuestionTypes?: string[];
    showQuestionMarks?: boolean;
    enabledDifficulties?: QuestionDifficultyLevel[];
    autoQuestionCode?: boolean;
    defaultMarks?: Partial<Record<QuestionTypeKey, number>>;
    negativeMarkingEnabled?: boolean;
    negativeMarks?: number;
    negativeApplyTo?: NegativeMarkingApplyTo;
    preventDuplicates?: boolean;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    allowImport?: boolean;
    allowExport?: boolean;
    requireApproval?: boolean;
  },
) {
  const existing = await ensureSetting(tenantId);
  const nextMarks = {
    ...parseDefaultMarks(existing.defaultMarks),
    ...(input.defaultMarks ?? {}),
  };
  for (const key of QUESTION_TYPE_KEYS) {
    if (nextMarks[key] < 0 || nextMarks[key] > 1000) {
      throw new AppError(400, "Default marks must be between 0 and 1000", "INVALID_MARKS");
    }
  }
  if (input.negativeMarks !== undefined && (input.negativeMarks < 0 || input.negativeMarks > 100)) {
    throw new AppError(400, "Negative marks must be between 0 and 100", "INVALID_NEGATIVE_MARKS");
  }

  const updated = await prisma.tenantQuestionBankSetting.update({
    where: { tenantId },
    data: {
      scope: input.scope,
      enabledQuestionTypes: input.enabledQuestionTypes
        ? normalizeTypes(input.enabledQuestionTypes)
        : undefined,
      showQuestionMarks: input.showQuestionMarks,
      enabledDifficulties: input.enabledDifficulties
        ? { set: normalizeDifficulties(input.enabledDifficulties) }
        : undefined,
      autoQuestionCode: input.autoQuestionCode,
      defaultMarks: nextMarks,
      negativeMarkingEnabled: input.negativeMarkingEnabled,
      negativeMarks: input.negativeMarks,
      negativeApplyTo: input.negativeApplyTo,
      preventDuplicates: input.preventDuplicates,
      shuffleQuestions: input.shuffleQuestions,
      shuffleOptions: input.shuffleOptions,
      allowImport: input.allowImport,
      allowExport: input.allowExport,
      requireApproval: input.requireApproval,
    },
    include: {
      difficultyRules: { orderBy: [{ sortOrder: "asc" }, { level: "asc" }] },
    },
  });

  return mapSetting(updated);
}

export async function upsertDifficultyRule(
  tenantId: string,
  input: {
    id?: string;
    level: QuestionDifficultyLevel;
    fromPercent: number;
    toPercent: number;
    description?: string | null;
  },
) {
  if (input.fromPercent < 0 || input.toPercent > 100 || input.fromPercent > input.toPercent) {
    throw new AppError(400, "Percent range must be within 0–100 and From ≤ To", "INVALID_PERCENT_RANGE");
  }
  const setting = await ensureSetting(tenantId);

  const overlap = await prisma.questionBankDifficultyRule.findFirst({
    where: {
      settingId: setting.id,
      ...(input.id ? { id: { not: input.id } } : {}),
      fromPercent: { lte: input.toPercent },
      toPercent: { gte: input.fromPercent },
    },
  });
  if (overlap) {
    throw new AppError(409, "Difficulty percent ranges must not overlap", "DIFFICULTY_OVERLAP");
  }

  if (input.id) {
    const existing = await prisma.questionBankDifficultyRule.findFirst({
      where: { id: input.id, tenantId },
    });
    if (!existing) throw new AppError(404, "Difficulty rule not found", "DIFFICULTY_NOT_FOUND");
    await prisma.questionBankDifficultyRule.update({
      where: { id: input.id },
      data: {
        level: input.level,
        fromPercent: input.fromPercent,
        toPercent: input.toPercent,
        description: input.description?.trim() || null,
      },
    });
  } else {
    const maxSort = await prisma.questionBankDifficultyRule.aggregate({
      where: { settingId: setting.id },
      _max: { sortOrder: true },
    });
    await prisma.questionBankDifficultyRule.create({
      data: {
        tenantId,
        settingId: setting.id,
        level: input.level,
        fromPercent: input.fromPercent,
        toPercent: input.toPercent,
        description: input.description?.trim() || null,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  return getQuestionBankSettings(tenantId);
}

export async function deleteDifficultyRule(tenantId: string, id: string) {
  const result = await prisma.questionBankDifficultyRule.deleteMany({
    where: { id, tenantId },
  });
  if (!result.count) throw new AppError(404, "Difficulty rule not found", "DIFFICULTY_NOT_FOUND");
  return getQuestionBankSettings(tenantId);
}
