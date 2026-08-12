import type { NextFunction, Request, Response } from "express";
import { AppError, asyncHandler } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

/** Role codes that can always manage / publish questions. */
export const QUESTION_BANK_ADMIN_ROLES = ["INSTITUTION_ADMIN", "STAFF"] as const;

export function isQuestionBankAdmin(roles: string[] | undefined) {
  return (roles ?? []).some((role) =>
    (QUESTION_BANK_ADMIN_ROLES as readonly string[]).includes(role),
  );
}

export function isTeacher(roles: string[] | undefined) {
  return (roles ?? []).includes("TEACHER");
}

async function teachersMayAddQuestions(tenantId: string) {
  const settings = await prisma.tenantQuestionBankSetting.findUnique({
    where: { tenantId },
    select: { allowTeachersToAddQuestions: true },
  });
  return settings?.allowTeachersToAddQuestions ?? false;
}

/** Teachers (when toggle on) or admins may create/edit. */
export const canCreateOrEditQuestion = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");

  if (isQuestionBankAdmin(auth.roles)) {
    next();
    return;
  }

  if (isTeacher(auth.roles)) {
    if (await teachersMayAddQuestions(auth.tenantId)) {
      next();
      return;
    }

    throw new AppError(
      403,
      "Question creation by teachers is currently disabled for your school. Contact your administrator.",
      "TEACHER_QUESTION_CREATE_DISABLED",
    );
  }

  throw new AppError(403, "Not authorized to manage questions", "FORBIDDEN");
});

/** Only admins may publish or archive. */
export function canPublishQuestion(req: Request, _res: Response, next: NextFunction) {
  const auth = req.auth;
  if (!auth) return next(new AppError(401, "Unauthenticated", "AUTH_REQUIRED"));

  if (!isQuestionBankAdmin(auth.roles)) {
    return next(
      new AppError(403, "Only an administrator can publish questions", "FORBIDDEN"),
    );
  }

  next();
}

/**
 * Teachers may only modify their own DRAFT questions.
 * Admins may modify any non-deleted question in the tenant.
 */
export const canModifyThisQuestion = asyncHandler(async (req, _res, next) => {
  const auth = req.auth;
  if (!auth?.tenantId) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");

  const id = String(req.params.id ?? "");
  const question = await prisma.question.findFirst({
    where: { id, tenantId: auth.tenantId, deletedAt: null },
  });

  if (!question) throw new AppError(404, "Question not found", "QUESTION_NOT_FOUND");

  if (isQuestionBankAdmin(auth.roles)) {
    req.question = question;
    next();
    return;
  }

  if (isTeacher(auth.roles)) {
    if (!(await teachersMayAddQuestions(auth.tenantId))) {
      throw new AppError(
        403,
        "Question creation by teachers is currently disabled for your school. Contact your administrator.",
        "TEACHER_QUESTION_CREATE_DISABLED",
      );
    }
  } else {
    throw new AppError(403, "Not authorized to manage questions", "FORBIDDEN");
  }

  if (question.createdById !== auth.userId) {
    throw new AppError(403, "You can only edit questions you created", "FORBIDDEN");
  }

  if (question.status !== "DRAFT") {
    throw new AppError(
      403,
      "Published or archived questions can only be edited by an administrator",
      "FORBIDDEN",
    );
  }

  req.question = question;
  next();
});
