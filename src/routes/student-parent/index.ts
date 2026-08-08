import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import {
  authenticate,
  requireTenant,
} from "../../middleware/auth.middleware.js";
import { avatarUpload, documentUpload } from "../../lib/uploads.js";
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
  listPortalTeachersController,
  listPortalOnlineAttemptsController,
  listPortalOnlineExamsController,
  getPortalOnlineAttemptController,
  getPortalOnlineExamPaperController,
  startPortalOnlineAttemptController,
  submitPortalOnlineAttemptController,
  submitPortalHomeworkController,
  submitPortalTeacherRatingController,
  updatePortalStudentProfileController,
  uploadPortalDocumentController,
  uploadPortalStudentPhotoController,
} from "../../modules/portal/portal.controller.js";
import {
  confirmPortalOnlineOrderController,
  createPortalOnlineOrderController,
  getOnlinePaymentConfigController,
  getPortalOnlineOrderController,
} from "../../modules/fees/online-payments.controller.js";
import {
  getUnreadCountController,
  listNotificationsController,
  markAllReadController,
  markReadController,
} from "../../modules/notifications/notifications.controller.js";

export const portalRouter = Router();

portalRouter.use(authenticate, requireTenant);
portalRouter.get("/overview", asyncHandler(getPortalOverviewController));
portalRouter.get("/notices", asyncHandler(listPortalNoticesController));
portalRouter.get("/notifications", asyncHandler(listNotificationsController));
portalRouter.get("/notifications/unread-count", asyncHandler(getUnreadCountController));
portalRouter.put("/notifications/read-all", asyncHandler(markAllReadController));
portalRouter.put("/notifications/:id/read", asyncHandler(markReadController));
portalRouter.get("/children/:studentId/attendance", asyncHandler(getPortalAttendanceController));
portalRouter.get("/children/:studentId/leaves", asyncHandler(getPortalLeavesController));
portalRouter.post("/children/:studentId/leaves", asyncHandler(createPortalLeaveController));
portalRouter.get("/children/:studentId/fees", asyncHandler(getPortalFeesController));
portalRouter.get("/fees/online/config", asyncHandler(getOnlinePaymentConfigController));
portalRouter.post(
  "/children/:studentId/fees/online/orders",
  asyncHandler(createPortalOnlineOrderController),
);
portalRouter.get("/fees/online/orders/:id", asyncHandler(getPortalOnlineOrderController));
portalRouter.post(
  "/fees/online/orders/:id/confirm",
  asyncHandler(confirmPortalOnlineOrderController),
);
portalRouter.get("/children/:studentId/documents", asyncHandler(getPortalDocumentsController));
portalRouter.post(
  "/children/:studentId/documents",
  documentUpload.single("file"),
  asyncHandler(uploadPortalDocumentController),
);
portalRouter.get("/children/:studentId/timetable", asyncHandler(getPortalTimetableController));
portalRouter.get("/children/:studentId/homework", asyncHandler(getPortalHomeworkController));
portalRouter.get(
  "/children/:studentId/online-exams/attempts",
  asyncHandler(listPortalOnlineAttemptsController),
);
portalRouter.get(
  "/children/:studentId/online-exams/attempts/:attemptId",
  asyncHandler(getPortalOnlineAttemptController),
);
portalRouter.post(
  "/children/:studentId/online-exams/attempts/:attemptId/submit",
  asyncHandler(submitPortalOnlineAttemptController),
);
portalRouter.get(
  "/children/:studentId/online-exams",
  asyncHandler(listPortalOnlineExamsController),
);
portalRouter.get(
  "/children/:studentId/online-exams/:examId",
  asyncHandler(getPortalOnlineExamPaperController),
);
portalRouter.post(
  "/children/:studentId/online-exams/:examId/attempts",
  asyncHandler(startPortalOnlineAttemptController),
);
portalRouter.get("/children/:studentId/teachers", asyncHandler(listPortalTeachersController));
portalRouter.post(
  "/children/:studentId/teachers/:staffId/ratings",
  asyncHandler(submitPortalTeacherRatingController),
);
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
