/**
 * Test Series permission model (v1 paper-builder)
 * ================================================
 *
 * Ownership unit = the **series**, not the individual paper.
 * - `TestSeries.createdById` is the sole teacher owner.
 * - Papers have no `createdById`; every paper inherits the parent series' owner.
 *
 * Teacher rules (when `allowTeachersToCreateTestSeries` is on):
 * - May create series; may create/edit/delete papers and question links only on
 *   their own DRAFT series / DRAFT papers.
 * - Cannot add papers to another teacher's series (create uses `canModifyThisSeries`).
 * - Cannot publish/archive — admin/staff only (`canPublishTestSeries`).
 *
 * Admin override (intentional, not a bug):
 * - Admins may create a DRAFT paper on Teacher A's series.
 * - Teacher A can then edit/delete that paper while it remains DRAFT, because
 *   edit rights check series ownership, not "who inserted the paper row".
 * - Do not "fix" this by adding paper-level createdBy checks without a product
 *   decision to support multi-teacher co-authoring.
 *
 * Student attempts / scheduling / results are out of scope for v1.
 */
import type { NextFunction, Request, Response } from "express";
import { AppError, asyncHandler } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export const TEST_SERIES_ADMIN_ROLES = ["INSTITUTION_ADMIN", "STAFF"] as const;

export function isTestSeriesAdmin(roles: string[] | undefined) {
  return (roles ?? []).some((role) =>
    (TEST_SERIES_ADMIN_ROLES as readonly string[]).includes(role),
  );
}

export function isTeacher(roles: string[] | undefined) {
  return (roles ?? []).includes("TEACHER");
}

async function teachersMayCreateTestSeries(tenantId: string) {
  const settings = await prisma.tenantTestSeriesSetting.findUnique({
    where: { tenantId },
    select: { allowTeachersToCreateTestSeries: true },
  });
  return settings?.allowTeachersToCreateTestSeries ?? false;
}

async function assertTeacherToggle(tenantId: string, roles: string[] | undefined) {
  if (isTestSeriesAdmin(roles)) return;
  if (!isTeacher(roles)) {
    throw new AppError(403, "Not authorized to manage test series", "FORBIDDEN");
  }
  if (!(await teachersMayCreateTestSeries(tenantId))) {
    throw new AppError(
      403,
      "Test series creation by teachers is currently disabled for your school. Contact your administrator.",
      "TEACHER_TEST_SERIES_CREATE_DISABLED",
    );
  }
}

/** Teachers (when toggle on) or admins may create/edit. */
export const canCreateOrEditTestSeries = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  await assertTeacherToggle(auth.tenantId, auth.roles);
  next();
});

/** Only admins may publish or archive. */
export function canPublishTestSeries(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) return next(new AppError(401, "Unauthenticated", "AUTH_REQUIRED"));
  if (!isTestSeriesAdmin(auth.roles)) {
    return next(
      new AppError(403, "Only an administrator can publish or archive test series", "FORBIDDEN"),
    );
  }
  next();
}

/**
 * Teachers may only modify their own DRAFT series.
 * Admins may modify any series in the tenant.
 *
 * Paper create (`POST /:id/papers`) also uses this gate so teachers cannot
 * attach papers to someone else's series (see file header ownership notes).
 */
export const canModifyThisSeries = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");

  const id = String(req.params.id ?? "");
  const series = await prisma.testSeries.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!series) throw new AppError(404, "Test series not found", "TEST_SERIES_NOT_FOUND");

  if (isTestSeriesAdmin(auth.roles)) {
    req.testSeries = series;
    next();
    return;
  }

  await assertTeacherToggle(auth.tenantId, auth.roles);

  if (series.createdById !== auth.userId) {
    throw new AppError(403, "You can only edit test series you created", "FORBIDDEN");
  }
  if (series.status !== "DRAFT") {
    throw new AppError(
      403,
      "Published or archived test series can only be edited by an administrator",
      "FORBIDDEN",
    );
  }

  req.testSeries = series;
  next();
});

/**
 * Paper ownership follows the parent series creator (not a per-paper author).
 * Teachers may only modify DRAFT papers on their own series.
 *
 * Consequence: a paper drafted by an admin on Teacher A's series is editable
 * by Teacher A while DRAFT. That is intentional — see file header.
 */
export const canModifyThisPaper = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");

  const seriesId = String(req.params.id ?? "");
  const paperId = String(req.params.paperId ?? "");
  const paper = await prisma.testSeriesPaper.findFirst({
    where: { id: paperId, tenantId: auth.tenantId, seriesId },
    include: {
      series: { select: { id: true, createdById: true, status: true } },
    },
  });
  if (!paper) throw new AppError(404, "Test paper not found", "TEST_PAPER_NOT_FOUND");

  if (isTestSeriesAdmin(auth.roles)) {
    req.testSeriesPaper = paper;
    next();
    return;
  }

  await assertTeacherToggle(auth.tenantId, auth.roles);

  if (paper.series.createdById !== auth.userId) {
    throw new AppError(403, "You can only edit papers on test series you created", "FORBIDDEN");
  }
  if (paper.status !== "DRAFT") {
    throw new AppError(
      403,
      "Published or archived papers can only be edited by an administrator",
      "FORBIDDEN",
    );
  }

  req.testSeriesPaper = paper;
  next();
});
