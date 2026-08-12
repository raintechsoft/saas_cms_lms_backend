import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { avatarUpload } from "../../lib/uploads.js";
import {
  authConfigController,
  changePasswordController,
  deleteAccountController,
  forgotPasswordController,
  googleLoginController,
  loginController,
  meController,
  msg91OtpLoginController,
  requestOtpController,
  resetPasswordController,
  updateProfileController,
  uploadAvatarController,
  verifyOtpController,
} from "../../modules/auth/auth.controller.js";
import { dashboardController } from "../../modules/dashboard/dashboard.controller.js";

export const authRouter = Router();

authRouter.get("/auth/config", asyncHandler(authConfigController));
authRouter.post("/auth/login", asyncHandler(loginController));
authRouter.post("/auth/otp/request", asyncHandler(requestOtpController));
authRouter.post("/auth/otp/verify", asyncHandler(verifyOtpController));
authRouter.post("/auth/otp/msg91", asyncHandler(msg91OtpLoginController));
authRouter.post("/auth/forgot-password", asyncHandler(forgotPasswordController));
authRouter.post("/auth/reset-password", asyncHandler(resetPasswordController));
authRouter.post("/auth/google", asyncHandler(googleLoginController));
authRouter.get("/auth/me", authenticate, asyncHandler(meController));
authRouter.put("/auth/profile", authenticate, asyncHandler(updateProfileController));
authRouter.post("/auth/change-password", authenticate, asyncHandler(changePasswordController));
authRouter.post("/auth/delete-account", authenticate, asyncHandler(deleteAccountController));
authRouter.post(
  "/auth/profile/avatar",
  authenticate,
  (req, res, next) => {
    avatarUpload.single("avatar")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof Error && error.message === "Only image files are allowed") {
        res.status(400).json({
          error: { code: "INVALID_FILE_TYPE", message: error.message },
        });
        return;
      }
      if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error: { code: "FILE_TOO_LARGE", message: "Image must be 3MB or smaller" },
        });
        return;
      }
      next(error);
    });
  },
  asyncHandler(uploadAvatarController),
);
authRouter.get("/dashboard", authenticate, asyncHandler(dashboardController));
