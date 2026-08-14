/**
 * Live Classes permission model (v1)
 * ==================================
 * Ownership for draft edit/delete = `createdById`.
 * Session host = `hostTeacherId` (may differ from creator — admin schedules for a teacher).
 * Teachers (toggle on) may create and edit/delete their own DRAFT sessions.
 * Only admin/staff may publish or cancel.
 */
import type { NextFunction, Request, Response } from "express";
import { AppError, asyncHandler } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export const LIVE_CLASSES_ADMIN_ROLES = ["INSTITUTION_ADMIN", "STAFF"] as const;

export function isLiveClassesAdmin(roles: string[] | undefined) {
  return (roles ?? []).some((role) =>
    (LIVE_CLASSES_ADMIN_ROLES as readonly string[]).includes(role),
  );
}

export function isTeacher(roles: string[] | undefined) {
  return (roles ?? []).includes("TEACHER");
}

async function teachersMayCreate(tenantId: string) {
  const settings = await prisma.tenantLiveClassesSetting.findUnique({
    where: { tenantId },
    select: { allowTeachersToCreateLiveClasses: true },
  });
  return settings?.allowTeachersToCreateLiveClasses ?? false;
}

async function assertTeacherToggle(tenantId: string, roles: string[] | undefined) {
  if (isLiveClassesAdmin(roles)) return;
  if (!isTeacher(roles)) {
    throw new AppError(403, "Not authorized to manage live classes", "FORBIDDEN");
  }
  if (!(await teachersMayCreate(tenantId))) {
    throw new AppError(
      403,
      "Live class creation by teachers is currently disabled for your school. Contact your administrator.",
      "TEACHER_LIVE_CLASS_CREATE_DISABLED",
    );
  }
}

export const canCreateOrEditLiveClass = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  await assertTeacherToggle(auth.tenantId, auth.roles);
  next();
});

export function canPublishLiveClass(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) return next(new AppError(401, "Unauthenticated", "AUTH_REQUIRED"));
  if (!isLiveClassesAdmin(auth.roles)) {
    return next(
      new AppError(403, "Only an administrator can publish or cancel live classes", "FORBIDDEN"),
    );
  }
  next();
}

export const canModifyThisLiveClass = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");

  const id = String(req.params.id ?? "");
  const session = await prisma.liveClass.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!session) throw new AppError(404, "Live class not found", "LIVE_CLASS_NOT_FOUND");

  if (isLiveClassesAdmin(auth.roles)) {
    req.liveClass = session;
    next();
    return;
  }

  await assertTeacherToggle(auth.tenantId, auth.roles);

  if (session.createdById !== auth.userId) {
    throw new AppError(403, "You can only edit live classes you created", "FORBIDDEN");
  }
  if (session.status !== "DRAFT") {
    throw new AppError(
      403,
      "Published or cancelled live classes can only be edited by an administrator",
      "FORBIDDEN",
    );
  }

  req.liveClass = session;
  next();
});
