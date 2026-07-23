import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import {
  authenticate,
  requirePlatform,
} from "../../middleware/auth.middleware.js";
import {
  assignTenantsToResellerController,
  createResellerController,
  createTenantController,
  deletePlatformUserController,
  getPlatformAuditController,
  getPlatformSettingsController,
  getPlatformStatsController,
  getResellerDetailController,
  getTenantDetailController,
  listPlatformUsersController,
  listResellersController,
  listTenantsController,
  setTenantStatusController,
  setUserStatusController,
  updatePlatformSettingsController,
  updatePlatformUserController,
  updateResellerController,
  updateTenantController,
} from "../../modules/platform/platform.controller.js";

export const platformRouter = Router();

platformRouter.use(authenticate, requirePlatform);
platformRouter.get("/stats", asyncHandler(getPlatformStatsController));
platformRouter.get("/settings", asyncHandler(getPlatformSettingsController));
platformRouter.put("/settings", asyncHandler(updatePlatformSettingsController));
platformRouter.get("/tenants", asyncHandler(listTenantsController));
platformRouter.post("/tenants", asyncHandler(createTenantController));
platformRouter.get("/tenants/:id", asyncHandler(getTenantDetailController));
platformRouter.put("/tenants/:id", asyncHandler(updateTenantController));
platformRouter.put("/tenants/:id/status", asyncHandler(setTenantStatusController));
platformRouter.get("/resellers", asyncHandler(listResellersController));
platformRouter.post("/resellers", asyncHandler(createResellerController));
platformRouter.get("/resellers/:id", asyncHandler(getResellerDetailController));
platformRouter.put("/resellers/:id", asyncHandler(updateResellerController));
platformRouter.put("/resellers/:id/tenants", asyncHandler(assignTenantsToResellerController));
platformRouter.get("/users", asyncHandler(listPlatformUsersController));
platformRouter.put("/users/:id", asyncHandler(updatePlatformUserController));
platformRouter.put("/users/:id/status", asyncHandler(setUserStatusController));
platformRouter.delete("/users/:id", asyncHandler(deletePlatformUserController));
platformRouter.get("/audit", asyncHandler(getPlatformAuditController));
