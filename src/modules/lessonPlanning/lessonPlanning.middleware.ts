/**
 * Lesson Planning permission model (v1)
 * =====================================
 * Ownership unit = the lesson plan (`createdById`), same as Question Bank drafts.
 * Teachers (toggle on) may create and edit/delete their own DRAFT plans.
 * Only admin/staff may publish or archive.
 */
import type { NextFunction, Request, Response } from "express";
import { AppError, asyncHandler } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export const LESSON_PLANNING_ADMIN_ROLES = ["INSTITUTION_ADMIN", "STAFF"] as const;

export function isLessonPlanningAdmin(roles: string[] | undefined) {
  return (roles ?? []).some((role) =>
    (LESSON_PLANNING_ADMIN_ROLES as readonly string[]).includes(role),
  );
}

export function isTeacher(roles: string[] | undefined) {
  return (roles ?? []).includes("TEACHER");
}

async function teachersMayCreate(tenantId: string) {
  const settings = await prisma.tenantLessonPlanningSetting.findUnique({
    where: { tenantId },
    select: { allowTeachersToCreateLessonPlans: true },
  });
  return settings?.allowTeachersToCreateLessonPlans ?? false;
}

async function assertTeacherToggle(tenantId: string, roles: string[] | undefined) {
  if (isLessonPlanningAdmin(roles)) return;
  if (!isTeacher(roles)) {
    throw new AppError(403, "Not authorized to manage lesson plans", "FORBIDDEN");
  }
  if (!(await teachersMayCreate(tenantId))) {
    throw new AppError(
      403,
      "Lesson plan creation by teachers is currently disabled for your school. Contact your administrator.",
      "TEACHER_LESSON_PLAN_CREATE_DISABLED",
    );
  }
}

export const canCreateOrEditLessonPlan = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  await assertTeacherToggle(auth.tenantId, auth.roles);
  next();
});

export function canPublishLessonPlan(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) return next(new AppError(401, "Unauthenticated", "AUTH_REQUIRED"));
  if (!isLessonPlanningAdmin(auth.roles)) {
    return next(
      new AppError(403, "Only an administrator can publish or archive lesson plans", "FORBIDDEN"),
    );
  }
  next();
}

export const canModifyThisLessonPlan = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");

  const id = String(req.params.id ?? "");
  const plan = await prisma.lessonPlan.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!plan) throw new AppError(404, "Lesson plan not found", "LESSON_PLAN_NOT_FOUND");

  if (isLessonPlanningAdmin(auth.roles)) {
    req.lessonPlan = plan;
    next();
    return;
  }

  await assertTeacherToggle(auth.tenantId, auth.roles);

  if (plan.createdById !== auth.userId) {
    throw new AppError(403, "You can only edit lesson plans you created", "FORBIDDEN");
  }
  if (plan.status !== "DRAFT") {
    throw new AppError(
      403,
      "Published or archived lesson plans can only be edited by an administrator",
      "FORBIDDEN",
    );
  }

  req.lessonPlan = plan;
  next();
});
