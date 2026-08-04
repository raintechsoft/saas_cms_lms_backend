import {
  HomeworkStatus,
  HomeworkSubmissionStatus,
} from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createHomework,
  evaluateHomeworkSubmission,
  getHomework,
  getHomeworkReport,
  getHomeworkSetup,
  getHomeworkSubmissions,
  runHomeworkNamedReport,
  submitHomework,
  updateHomework,
} from "./homework.service.js";

const idParams = z.object({ id: z.string().min(1) });
const setupQuery = z.object({
  sessionId: z.string().min(1).optional(),
  classSectionId: z.string().min(1).optional(),
  classSubjectId: z.string().min(1).optional(),
  status: z.nativeEnum(HomeworkStatus).optional(),
  q: z.string().trim().max(200).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
const homeworkBody = z.object({
  academicSessionId: z.string().min(1),
  classSectionId: z.string().min(1),
  classSubjectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  // Either a regular link or an uploaded file stored as a data URL.
  attachmentUrl: z
    .string()
    .min(1)
    .max(30_000_000)
    .refine(
      (value) =>
        value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:"),
      "Attachment must be a link or an uploaded file",
    )
    .nullable()
    .optional(),
  homeworkDate: z.coerce.date(),
  submissionDate: z.coerce.date(),
  status: z.nativeEnum(HomeworkStatus).default(HomeworkStatus.PUBLISHED),
});
const attachmentField = z
  .string()
  .min(1)
  .max(30_000_000)
  .refine(
    (value) =>
      value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:"),
    "Attachment must be a link or an uploaded file",
  )
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));
const submissionBody = z.object({
  studentEnrollmentId: z.string().min(1),
  answerText: z.string().trim().max(20000).nullable().optional(),
  attachmentUrl: attachmentField,
});
const evaluationBody = z.object({
  status: z.enum([
    HomeworkSubmissionStatus.EVALUATED,
    HomeworkSubmissionStatus.COMPLETED,
    HomeworkSubmissionStatus.RESUBMIT_REQUESTED,
  ]),
  review: z.string().trim().min(1).max(5000),
});
const reportQuery = z.object({
  sessionId: z.string().min(1),
  classSectionId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
const namedReportParams = z.object({
  reportKey: z.enum(["complete", "progress", "due"]),
});
export async function getHomeworkSetupController(req: Request, res: Response) {
  res.json({
    data: await getHomeworkSetup(
      req.auth!.tenantId!,
      setupQuery.parse(req.query),
      { userId: req.auth!.userId, roles: req.auth!.roles },
    ),
  });
}

export async function getHomeworkController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getHomework(req.auth!.tenantId!, id) });
}

export async function createHomeworkController(req: Request, res: Response) {
  res.status(201).json({
    data: await createHomework(
      req.auth!.tenantId!,
      req.auth!.userId,
      homeworkBody.parse(req.body),
    ),
  });
}

export async function updateHomeworkController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateHomework(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
      homeworkBody.parse(req.body),
    ),
  });
}

export async function getHomeworkSubmissionsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getHomeworkSubmissions(req.auth!.tenantId!, id) });
}

export async function submitHomeworkController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.status(201).json({
    data: await submitHomework(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
      submissionBody.parse(req.body),
    ),
  });
}

export async function evaluateHomeworkSubmissionController(
  req: Request,
  res: Response,
) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await evaluateHomeworkSubmission(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
      evaluationBody.parse(req.body),
    ),
  });
}

export async function getHomeworkReportController(req: Request, res: Response) {
  res.json({
    data: await getHomeworkReport(req.auth!.tenantId!, reportQuery.parse(req.query)),
  });
}

export async function getHomeworkNamedReportController(req: Request, res: Response) {
  const { reportKey } = namedReportParams.parse(req.params);
  res.json({
    data: await runHomeworkNamedReport(
      req.auth!.tenantId!,
      reportKey,
      reportQuery.parse(req.query),
    ),
  });
}
