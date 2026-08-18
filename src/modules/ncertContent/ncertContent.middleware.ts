/**
 * NCERT Content permission model (v1)
 * ===================================
 * Ownership unit = the resource (`createdById`), same as Lesson Planning drafts.
 * Teachers (toggle on) may create and edit/delete their own DRAFT resources.
 * Only admin/staff may publish or archive.
 */
import type { NextFunction, Request, Response } from "express";
import { AppError, asyncHandler } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export const NCERT_ADMIN_ROLES = ["INSTITUTION_ADMIN", "STAFF"] as const;

export function isNcertAdmin(roles: string[] | undefined) {
  return (roles ?? []).some((role) => (NCERT_ADMIN_ROLES as readonly string[]).includes(role));
}

export function isTeacher(roles: string[] | undefined) {
  return (roles ?? []).includes("TEACHER");
}

async function teachersMayCreate(tenantId: string) {
  const settings = await prisma.tenantNcertSetting.findUnique({
    where: { tenantId },
    select: { allowTeachersToCreateNcertResources: true },
  });
  return settings?.allowTeachersToCreateNcertResources ?? false;
}

async function assertTeacherToggle(tenantId: string, roles: string[] | undefined) {
  if (isNcertAdmin(roles)) return;
  if (!isTeacher(roles)) {
    throw new AppError(403, "Not authorized to manage NCERT resources", "FORBIDDEN");
  }
  if (!(await teachersMayCreate(tenantId))) {
    throw new AppError(
      403,
      "NCERT resource creation by teachers is currently disabled for your school. Contact your administrator.",
      "TEACHER_NCERT_CREATE_DISABLED",
    );
  }
}

export const canCreateOrEditNcertResource = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  await assertTeacherToggle(auth.tenantId, auth.roles);
  next();
});

export function canPublishNcertResource(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) return next(new AppError(401, "Unauthenticated", "AUTH_REQUIRED"));
  if (!isNcertAdmin(auth.roles)) {
    return next(
      new AppError(403, "Only an administrator can publish or archive NCERT resources", "FORBIDDEN"),
    );
  }
  next();
}

export const canModifyThisNcertResource = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");

  const id = String(req.params.id ?? "");
  const resource = await prisma.ncertResource.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!resource) throw new AppError(404, "NCERT resource not found", "NCERT_RESOURCE_NOT_FOUND");

  if (isNcertAdmin(auth.roles)) {
    req.ncertResource = resource;
    next();
    return;
  }

  await assertTeacherToggle(auth.tenantId, auth.roles);

  if (resource.createdById !== auth.userId) {
    throw new AppError(403, "You can only edit NCERT resources you created", "FORBIDDEN");
  }
  if (resource.status !== "DRAFT") {
    throw new AppError(
      403,
      "Published or archived NCERT resources can only be edited by an administrator",
      "FORBIDDEN",
    );
  }

  req.ncertResource = resource;
  next();
});
