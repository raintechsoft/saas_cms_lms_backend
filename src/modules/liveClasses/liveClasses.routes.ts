import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { requireAnyPermission, requireRole } from "../../middleware/auth.middleware.js";
import {
  cancelLiveClassController,
  createLiveClassController,
  deleteLiveClassController,
  getLiveClassController,
  getSettingsController,
  getStatsController,
  listLiveClassesController,
  publishLiveClassController,
  updateLiveClassController,
  updateSettingsController,
} from "./liveClasses.controller.js";
import {
  canCreateOrEditLiveClass,
  canModifyThisLiveClass,
  canPublishLiveClass,
  LIVE_CLASSES_ADMIN_ROLES,
} from "./liveClasses.middleware.js";

/** Mounted at `/campus/live-classes` → `/api/v1/live-classes`. */
export const liveClassesRouter = Router();

const manage = requireAnyPermission("live_classes.manage");
const adminOnly = requireRole(...LIVE_CLASSES_ADMIN_ROLES);

liveClassesRouter.get("/settings", asyncHandler(getSettingsController));
liveClassesRouter.patch("/settings", manage, adminOnly, asyncHandler(updateSettingsController));
liveClassesRouter.get("/stats", asyncHandler(getStatsController));

liveClassesRouter.get("/", asyncHandler(listLiveClassesController));
liveClassesRouter.post("/", manage, canCreateOrEditLiveClass, asyncHandler(createLiveClassController));
liveClassesRouter.get("/:id", asyncHandler(getLiveClassController));
liveClassesRouter.patch("/:id", manage, canModifyThisLiveClass, asyncHandler(updateLiveClassController));
liveClassesRouter.post(
  "/:id/publish",
  manage,
  canPublishLiveClass,
  asyncHandler(publishLiveClassController),
);
liveClassesRouter.post(
  "/:id/cancel",
  manage,
  canPublishLiveClass,
  asyncHandler(cancelLiveClassController),
);
liveClassesRouter.delete("/:id", manage, canModifyThisLiveClass, asyncHandler(deleteLiveClassController));
