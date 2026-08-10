import {
  HomeworkAutoReminderMode,
  HomeworkDueDateBehavior,
  HomeworkLatePenaltyType,
  HomeworkReminderUnit,
  HomeworkSubmissionStartMode,
} from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createHomeworkType,
  createHomeworkWorkflowStatus,
  deleteHomeworkType,
  deleteHomeworkWorkflowStatus,
  getHomeworkSettingsSetup,
  updateHomeworkSettings,
  updateHomeworkType,
  updateHomeworkWorkflowStatus,
} from "./homework-settings.service.js";

const idParams = z.object({ id: z.string().min(1) });

const settingsBody = z.object({
  moduleEnabled: z.boolean().optional(),
  allowTeachersAssign: z.boolean().optional(),
  allowAttachments: z.boolean().optional(),
  allowOnlineSubmission: z.boolean().optional(),
  allowLateSubmission: z.boolean().optional(),
  latePenaltyValue: z.coerce.number().min(0).max(100000).optional(),
  latePenaltyType: z.nativeEnum(HomeworkLatePenaltyType).optional(),
  allowPortalView: z.boolean().optional(),
  submissionStartsFrom: z.nativeEnum(HomeworkSubmissionStartMode).optional(),
  dueDateBehavior: z.nativeEnum(HomeworkDueDateBehavior).optional(),
  graceDays: z.coerce.number().int().min(0).max(365).optional(),
  reminderBeforeValue: z.coerce.number().int().min(0).max(365).optional(),
  reminderBeforeUnit: z.nativeEnum(HomeworkReminderUnit).optional(),
  autoReminderMode: z.nativeEnum(HomeworkAutoReminderMode).optional(),
  maxFileSizeMb: z.coerce.number().int().min(1).max(200).optional(),
  allowedFileTypes: z.array(z.string().trim().min(1).max(20)).max(30).optional(),
});

const typeBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

const statusBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{6})$/, "Color must be a hex value like #3B82F6")
    .optional(),
  isFinal: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function getHomeworkSettingsSetupController(req: Request, res: Response) {
  res.json({ data: await getHomeworkSettingsSetup(req.auth!.tenantId!) });
}

export async function updateHomeworkSettingsController(req: Request, res: Response) {
  res.json({
    data: await updateHomeworkSettings(req.auth!.tenantId!, settingsBody.parse(req.body)),
  });
}

export async function createHomeworkTypeController(req: Request, res: Response) {
  res.status(201).json({
    data: await createHomeworkType(req.auth!.tenantId!, typeBody.parse(req.body)),
  });
}

export async function updateHomeworkTypeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateHomeworkType(
      req.auth!.tenantId!,
      id,
      typeBody.partial().parse(req.body),
    ),
  });
}

export async function deleteHomeworkTypeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteHomeworkType(req.auth!.tenantId!, id) });
}

export async function createHomeworkWorkflowStatusController(req: Request, res: Response) {
  res.status(201).json({
    data: await createHomeworkWorkflowStatus(req.auth!.tenantId!, statusBody.parse(req.body)),
  });
}

export async function updateHomeworkWorkflowStatusController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateHomeworkWorkflowStatus(
      req.auth!.tenantId!,
      id,
      statusBody.partial().parse(req.body),
    ),
  });
}

export async function deleteHomeworkWorkflowStatusController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteHomeworkWorkflowStatus(req.auth!.tenantId!, id) });
}
