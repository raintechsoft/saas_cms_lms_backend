import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import { requireAnyPermission, requireRole } from "../../middleware/auth.middleware.js";
import {
  archiveAcademicEventController,
  createAcademicEventController,
  deleteAcademicEventController,
  getAcademicEventController,
  getSettingsController,
  getStatsController,
  listAcademicEventsController,
  publishAcademicEventController,
  updateAcademicEventController,
  updateSettingsController,
} from "./academicCalendar.controller.js";
import {
  ACADEMIC_CALENDAR_ADMIN_ROLES,
  canCreateOrEditAcademicEvent,
  canModifyThisAcademicEvent,
  canPublishAcademicEvent,
} from "./academicCalendar.middleware.js";

/** Mounted at `/campus/academic-calendar` → `/api/v1/academic-calendar`. */
export const academicCalendarRouter = Router();

const manage = requireAnyPermission("academic_calendar.manage");
const adminOnly = requireRole(...ACADEMIC_CALENDAR_ADMIN_ROLES);

academicCalendarRouter.get("/settings", asyncHandler(getSettingsController));
academicCalendarRouter.patch("/settings", manage, adminOnly, asyncHandler(updateSettingsController));
academicCalendarRouter.get("/stats", asyncHandler(getStatsController));

academicCalendarRouter.get("/", asyncHandler(listAcademicEventsController));
academicCalendarRouter.post(
  "/",
  manage,
  canCreateOrEditAcademicEvent,
  asyncHandler(createAcademicEventController),
);
academicCalendarRouter.get("/:id", asyncHandler(getAcademicEventController));
academicCalendarRouter.patch(
  "/:id",
  manage,
  canModifyThisAcademicEvent,
  asyncHandler(updateAcademicEventController),
);
academicCalendarRouter.post(
  "/:id/publish",
  manage,
  canPublishAcademicEvent,
  asyncHandler(publishAcademicEventController),
);
academicCalendarRouter.post(
  "/:id/archive",
  manage,
  canPublishAcademicEvent,
  asyncHandler(archiveAcademicEventController),
);
academicCalendarRouter.delete(
  "/:id",
  manage,
  canModifyThisAcademicEvent,
  asyncHandler(deleteAcademicEventController),
);
