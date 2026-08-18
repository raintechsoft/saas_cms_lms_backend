/**
 * Academic Calendar permission model (v1)
 * Teachers (toggle on) may create and edit/delete their own DRAFT events.
 * Only admin/staff may publish or archive.
 */
import type { NextFunction, Request, Response } from "express";
import { AppError, asyncHandler } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export const ACADEMIC_CALENDAR_ADMIN_ROLES = ["INSTITUTION_ADMIN", "STAFF"] as const;

export function isAcademicCalendarAdmin(roles: string[] | undefined) {
  return (roles ?? []).some((role) =>
    (ACADEMIC_CALENDAR_ADMIN_ROLES as readonly string[]).includes(role),
  );
}

function isTeacher(roles: string[] | undefined) {
  return (roles ?? []).includes("TEACHER");
}

async function teachersMayCreate(tenantId: string) {
  const settings = await prisma.tenantAcademicCalendarSetting.findUnique({
    where: { tenantId },
    select: { allowTeachersToCreateEvents: true },
  });
  return settings?.allowTeachersToCreateEvents ?? false;
}

async function assertTeacherToggle(tenantId: string, roles: string[] | undefined) {
  if (isAcademicCalendarAdmin(roles)) return;
  if (!isTeacher(roles)) {
    throw new AppError(403, "Not authorized to manage academic calendar events", "FORBIDDEN");
  }
  if (!(await teachersMayCreate(tenantId))) {
    throw new AppError(
      403,
      "Academic calendar event creation by teachers is currently disabled for your school. Contact your administrator.",
      "TEACHER_ACADEMIC_CALENDAR_CREATE_DISABLED",
    );
  }
}

export const canCreateOrEditAcademicEvent = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  await assertTeacherToggle(auth.tenantId, auth.roles);
  next();
});

export function canPublishAcademicEvent(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) return next(new AppError(401, "Unauthenticated", "AUTH_REQUIRED"));
  if (!isAcademicCalendarAdmin(auth.roles)) {
    return next(
      new AppError(403, "Only an administrator can publish or archive calendar events", "FORBIDDEN"),
    );
  }
  next();
}

export const canModifyThisAcademicEvent = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");

  const id = String(req.params.id ?? "");
  const event = await prisma.academicEvent.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!event) throw new AppError(404, "Calendar event not found", "ACADEMIC_EVENT_NOT_FOUND");

  if (isAcademicCalendarAdmin(auth.roles)) {
    next();
    return;
  }

  await assertTeacherToggle(auth.tenantId, auth.roles);

  if (event.createdById !== auth.userId) {
    throw new AppError(403, "You can only edit calendar events you created", "FORBIDDEN");
  }
  if (event.status !== "DRAFT") {
    throw new AppError(
      403,
      "Published or archived calendar events can only be edited by an administrator",
      "FORBIDDEN",
    );
  }

  next();
});
