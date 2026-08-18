import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { requireAnyPermission, requireRole } from "../../middleware/auth.middleware.js";
import {
  archiveLessonPlanController,
  createLessonPlanController,
  deleteLessonPlanController,
  getLessonPlanController,
  getSettingsController,
  getStatsController,
  listLessonPlansController,
  publishLessonPlanController,
  updateLessonPlanController,
  updateSettingsController,
} from "./lessonPlanning.controller.js";
import {
  canCreateOrEditLessonPlan,
  canModifyThisLessonPlan,
  canPublishLessonPlan,
  LESSON_PLANNING_ADMIN_ROLES,
} from "./lessonPlanning.middleware.js";

/** Mounted at `/campus/lesson-planning`. */
export const lessonPlanningRouter = Router();

const manage = requireAnyPermission("lesson_planning.manage");
const adminOnly = requireRole(...LESSON_PLANNING_ADMIN_ROLES);

lessonPlanningRouter.get("/settings", asyncHandler(getSettingsController));
lessonPlanningRouter.patch("/settings", manage, adminOnly, asyncHandler(updateSettingsController));
lessonPlanningRouter.get("/stats", asyncHandler(getStatsController));

lessonPlanningRouter.get("/", asyncHandler(listLessonPlansController));
lessonPlanningRouter.post("/", manage, canCreateOrEditLessonPlan, asyncHandler(createLessonPlanController));
lessonPlanningRouter.get("/:id", asyncHandler(getLessonPlanController));
lessonPlanningRouter.patch("/:id", manage, canModifyThisLessonPlan, asyncHandler(updateLessonPlanController));
lessonPlanningRouter.post(
  "/:id/publish",
  manage,
  canPublishLessonPlan,
  asyncHandler(publishLessonPlanController),
);
lessonPlanningRouter.post(
  "/:id/archive",
  manage,
  canPublishLessonPlan,
  asyncHandler(archiveLessonPlanController),
);
lessonPlanningRouter.delete("/:id", manage, canModifyThisLessonPlan, asyncHandler(deleteLessonPlanController));
