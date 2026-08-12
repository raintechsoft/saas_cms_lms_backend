import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import {
  authenticate,
  requireTenant,
} from "../../middleware/auth.middleware.js";
import {
  registerMobilePushController,
  testMobilePushController,
  unregisterMobilePushController,
} from "../../modules/mobile/mobile-push.controller.js";

export const portalMobileRouter = Router();

portalMobileRouter.use(authenticate, requireTenant);
portalMobileRouter.post("/push/register", asyncHandler(registerMobilePushController));
portalMobileRouter.post("/push/unregister", asyncHandler(unregisterMobilePushController));
portalMobileRouter.post("/push/test", asyncHandler(testMobilePushController));
