import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { requireRole } from "../../middleware/auth.middleware.js";
import {
  archiveQuestionController,
  createCategoryController,
  createDifficultyLevelController,
  createQuestionController,
  createQuestionTypeController,
  deleteCategoryController,
  deleteQuestionController,
  downloadImportTemplateController,
  getQuestionController,
  getSettingsController,
  getStatsController,
  importQuestionsController,
  listCategoriesController,
  listDifficultyLevelsController,
  listQuestionTypesController,
  listQuestionsController,
  publishQuestionController,
  seedDefaultsController,
  updateCategoryController,
  updateQuestionController,
  updateSettingsController,
} from "./questionBank.controller.js";
import {
  canCreateOrEditQuestion,
  canModifyThisQuestion,
  canPublishQuestion,
  QUESTION_BANK_ADMIN_ROLES,
} from "./questionBank.middleware.js";

/**
 * Mounted at `/campus/question-bank` (and compatibility root `/question-bank`).
 * Auth + tenant are applied by the parent campus router.
 */
export const questionBankRouter = Router();

const adminOnly = requireRole(...QUESTION_BANK_ADMIN_ROLES);

// Categories
questionBankRouter.get("/categories", asyncHandler(listCategoriesController));
questionBankRouter.post(
  "/categories",
  canCreateOrEditQuestion,
  asyncHandler(createCategoryController),
);
questionBankRouter.patch(
  "/categories/:id",
  canCreateOrEditQuestion,
  asyncHandler(updateCategoryController),
);
questionBankRouter.delete(
  "/categories/:id",
  canCreateOrEditQuestion,
  asyncHandler(deleteCategoryController),
);

// Questions
questionBankRouter.get("/questions", asyncHandler(listQuestionsController));
questionBankRouter.get(
  "/questions/import-template",
  canCreateOrEditQuestion,
  asyncHandler(downloadImportTemplateController),
);
questionBankRouter.post(
  "/questions/import",
  canCreateOrEditQuestion,
  asyncHandler(importQuestionsController),
);
questionBankRouter.get("/questions/:id", asyncHandler(getQuestionController));
questionBankRouter.post(
  "/questions",
  canCreateOrEditQuestion,
  asyncHandler(createQuestionController),
);
questionBankRouter.patch(
  "/questions/:id",
  canModifyThisQuestion,
  asyncHandler(updateQuestionController),
);
questionBankRouter.post(
  "/questions/:id/publish",
  canPublishQuestion,
  asyncHandler(publishQuestionController),
);
questionBankRouter.post(
  "/questions/:id/archive",
  canPublishQuestion,
  asyncHandler(archiveQuestionController),
);
questionBankRouter.delete(
  "/questions/:id",
  canModifyThisQuestion,
  asyncHandler(deleteQuestionController),
);

// Question type / difficulty masters (admin-managed)
questionBankRouter.get("/question-types", asyncHandler(listQuestionTypesController));
questionBankRouter.post(
  "/question-types",
  adminOnly,
  asyncHandler(createQuestionTypeController),
);
questionBankRouter.get("/difficulty-levels", asyncHandler(listDifficultyLevelsController));
questionBankRouter.post(
  "/difficulty-levels",
  adminOnly,
  asyncHandler(createDifficultyLevelController),
);

// Dashboard stats + module settings
questionBankRouter.get("/stats", asyncHandler(getStatsController));
questionBankRouter.get("/settings", asyncHandler(getSettingsController));
questionBankRouter.patch("/settings", adminOnly, asyncHandler(updateSettingsController));
questionBankRouter.post(
  "/seed-defaults",
  adminOnly,
  asyncHandler(seedDefaultsController),
);
