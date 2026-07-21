import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import {
  authenticate,
  requireTenant,
} from "../../middleware/auth.middleware.js";
import { avatarUpload } from "../../lib/uploads.js";
import {
  createPortalLeaveController,
  getPortalAttendanceController,
  getPortalDocumentsController,
  getPortalFeesController,
  getPortalHomeworkController,
  getPortalLeavesController,
  getPortalOverviewController,
  getPortalTimetableController,
  listPortalNoticesController,
  submitPortalHomeworkController,
  updatePortalStudentProfileController,
  uploadPortalStudentPhotoController,
} from "../../modules/portal/portal.controller.js";

export const portalRouter = Router();

portalRouter.use(authenticate, requireTenant);
portalRouter.get("/overview", asyncHandler(getPortalOverviewController));
portalRouter.get("/notices", asyncHandler(listPortalNoticesController));
portalRouter.get("/children/:studentId/attendance", asyncHandler(getPortalAttendanceController));
portalRouter.get("/children/:studentId/leaves", asyncHandler(getPortalLeavesController));
portalRouter.post("/children/:studentId/leaves", asyncHandler(createPortalLeaveController));
portalRouter.get("/children/:studentId/fees", asyncHandler(getPortalFeesController));
portalRouter.get("/children/:studentId/documents", asyncHandler(getPortalDocumentsController));
portalRouter.get("/children/:studentId/timetable", asyncHandler(getPortalTimetableController));
portalRouter.get("/children/:studentId/homework", asyncHandler(getPortalHomeworkController));
portalRouter.put(
  "/children/:studentId/profile",
  asyncHandler(updatePortalStudentProfileController),
);
portalRouter.post(
  "/children/:studentId/profile/photo",
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
  asyncHandler(uploadPortalStudentPhotoController),
);
portalRouter.post("/homework/:id/submissions", asyncHandler(submitPortalHomeworkController));
