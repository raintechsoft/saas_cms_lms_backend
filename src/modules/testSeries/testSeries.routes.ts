import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { requireAnyPermission } from "../../middleware/auth.middleware.js";
import {
  addQuestionsController,
  archivePaperController,
  archiveSeriesController,
  createPaperController,
  createSeriesController,
  deletePaperController,
  deleteSeriesController,
  getPaperController,
  getSeriesController,
  getSettingsController,
  listSeriesController,
  publishPaperController,
  publishSeriesController,
  pullQuestionsController,
  removeQuestionController,
  reorderQuestionsController,
  updatePaperController,
  updateQuestionLinkController,
  updateSeriesController,
  updateSettingsController,
} from "./testSeries.controller.js";
import {
  canCreateOrEditTestSeries,
  canModifyThisPaper,
  canModifyThisSeries,
  canPublishTestSeries,
  TEST_SERIES_ADMIN_ROLES,
} from "./testSeries.middleware.js";
import { requireRole } from "../../middleware/auth.middleware.js";

/**
 * Mounted at `/campus/test-series` (and compatibility root `/test-series`).
 * Auth + tenant + LMS entitlement + module gate applied by parent campus router.
 */
export const testSeriesRouter = Router();

const manage = requireAnyPermission("test_series.manage", "online_exam.manage");
const adminOnly = requireRole(...TEST_SERIES_ADMIN_ROLES);

testSeriesRouter.get("/settings", asyncHandler(getSettingsController));
testSeriesRouter.patch("/settings", manage, adminOnly, asyncHandler(updateSettingsController));

testSeriesRouter.get("/", asyncHandler(listSeriesController));
testSeriesRouter.post("/", manage, canCreateOrEditTestSeries, asyncHandler(createSeriesController));
testSeriesRouter.get("/:id", asyncHandler(getSeriesController));
testSeriesRouter.patch(
  "/:id",
  manage,
  canModifyThisSeries,
  asyncHandler(updateSeriesController),
);
testSeriesRouter.post(
  "/:id/publish",
  manage,
  canPublishTestSeries,
  asyncHandler(publishSeriesController),
);
testSeriesRouter.post(
  "/:id/archive",
  manage,
  canPublishTestSeries,
  asyncHandler(archiveSeriesController),
);
testSeriesRouter.delete(
  "/:id",
  manage,
  canModifyThisSeries,
  asyncHandler(deleteSeriesController),
);

testSeriesRouter.post(
  "/:id/papers",
  manage,
  canModifyThisSeries,
  asyncHandler(createPaperController),
);
testSeriesRouter.get("/:id/papers/:paperId", asyncHandler(getPaperController));
testSeriesRouter.patch(
  "/:id/papers/:paperId",
  manage,
  canModifyThisPaper,
  asyncHandler(updatePaperController),
);
testSeriesRouter.post(
  "/:id/papers/:paperId/publish",
  manage,
  canPublishTestSeries,
  asyncHandler(publishPaperController),
);
testSeriesRouter.post(
  "/:id/papers/:paperId/archive",
  manage,
  canPublishTestSeries,
  asyncHandler(archivePaperController),
);
testSeriesRouter.delete(
  "/:id/papers/:paperId",
  manage,
  canModifyThisPaper,
  asyncHandler(deletePaperController),
);

testSeriesRouter.post(
  "/:id/papers/:paperId/questions",
  manage,
  canModifyThisPaper,
  asyncHandler(addQuestionsController),
);
testSeriesRouter.post(
  "/:id/papers/:paperId/questions/from-bank",
  manage,
  canModifyThisPaper,
  asyncHandler(pullQuestionsController),
);
testSeriesRouter.put(
  "/:id/papers/:paperId/questions/order",
  manage,
  canModifyThisPaper,
  asyncHandler(reorderQuestionsController),
);
testSeriesRouter.patch(
  "/:id/papers/:paperId/questions/:linkId",
  manage,
  canModifyThisPaper,
  asyncHandler(updateQuestionLinkController),
);
testSeriesRouter.delete(
  "/:id/papers/:paperId/questions/:linkId",
  manage,
  canModifyThisPaper,
  asyncHandler(removeQuestionController),
);
