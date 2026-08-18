import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { documentUpload } from "../../lib/uploads.js";
import { requireAnyPermission, requireRole } from "../../middleware/auth.middleware.js";
import {
  archiveNcertResourceController,
  createNcertResourceController,
  deleteNcertResourceController,
  getNcertResourceController,
  getSettingsController,
  getStatsController,
  listNcertResourcesController,
  publishNcertResourceController,
  updateNcertResourceController,
  updateSettingsController,
  uploadNcertFileController,
} from "./ncertContent.controller.js";
import {
  canCreateOrEditNcertResource,
  canModifyThisNcertResource,
  canPublishNcertResource,
  NCERT_ADMIN_ROLES,
} from "./ncertContent.middleware.js";

/** Mounted at `/campus/ncert-content` → `/api/v1/ncert-content`. */
export const ncertContentRouter = Router();

const manage = requireAnyPermission("ncert.manage");
const adminOnly = requireRole(...NCERT_ADMIN_ROLES);

ncertContentRouter.get("/settings", asyncHandler(getSettingsController));
ncertContentRouter.patch("/settings", manage, adminOnly, asyncHandler(updateSettingsController));
ncertContentRouter.get("/stats", asyncHandler(getStatsController));

ncertContentRouter.post(
  "/upload",
  manage,
  canCreateOrEditNcertResource,
  documentUpload.single("file"),
  asyncHandler(uploadNcertFileController),
);

ncertContentRouter.get("/", asyncHandler(listNcertResourcesController));
ncertContentRouter.post("/", manage, canCreateOrEditNcertResource, asyncHandler(createNcertResourceController));
ncertContentRouter.get("/:id", asyncHandler(getNcertResourceController));
ncertContentRouter.patch(
  "/:id",
  manage,
  canModifyThisNcertResource,
  asyncHandler(updateNcertResourceController),
);
ncertContentRouter.post(
  "/:id/publish",
  manage,
  canPublishNcertResource,
  asyncHandler(publishNcertResourceController),
);
ncertContentRouter.post(
  "/:id/archive",
  manage,
  canPublishNcertResource,
  asyncHandler(archiveNcertResourceController),
);
ncertContentRouter.delete(
  "/:id",
  manage,
  canModifyThisNcertResource,
  asyncHandler(deleteNcertResourceController),
);
