import type { Request, Response } from "express";
import { z } from "zod";
import {
  createSystemBackupRecord,
  deleteBackupSchedule,
  deleteSystemBackupRecord,
  getBackupRestoreSetup,
  restoreSystemBackupRecord,
  saveBackupSettings,
  upsertBackupSchedule,
} from "./backup-restore.service.js";

const idParams = z.object({ id: z.string().min(1) });

const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["FULL", "DATABASE", "FILES"]).optional(),
  includeConfigSnapshot: z.boolean().optional(),
});

const settingsBody = z.object({
  retentionDays: z.coerce.number().int().min(1).max(365).optional(),
  primaryLocation: z.string().trim().max(200).optional(),
  secondaryLocation: z.string().trim().max(200).optional(),
  localEnabled: z.boolean().optional(),
  compressBackups: z.boolean().optional(),
  encryptBackups: z.boolean().optional(),
  notifyOnSuccess: z.boolean().optional(),
  notifyOnFailure: z.boolean().optional(),
});

const scheduleBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  timeOfDay: z.string().trim().regex(/^\d{2}:\d{2}$/),
  backupType: z.enum(["FULL", "DATABASE", "FILES"]),
  isActive: z.boolean().optional(),
});

export async function getBackupRestoreSetupController(req: Request, res: Response) {
  res.json({ data: await getBackupRestoreSetup(req.auth!.tenantId!) });
}

export async function createSystemBackupController(req: Request, res: Response) {
  const body = createBody.parse(req.body);
  res.status(201).json({
    data: await createSystemBackupRecord(req.auth!.tenantId!, req.auth!.userId, body),
  });
}

export async function deleteSystemBackupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteSystemBackupRecord(req.auth!.tenantId!, id) });
}

export async function restoreSystemBackupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await restoreSystemBackupRecord(req.auth!.tenantId!, req.auth!.userId, id),
  });
}

export async function saveBackupSettingsController(req: Request, res: Response) {
  res.json({
    data: await saveBackupSettings(req.auth!.tenantId!, settingsBody.parse(req.body)),
  });
}

export async function upsertBackupScheduleController(req: Request, res: Response) {
  res.json({
    data: await upsertBackupSchedule(req.auth!.tenantId!, scheduleBody.parse(req.body)),
  });
}

export async function deleteBackupScheduleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteBackupSchedule(req.auth!.tenantId!, id) });
}
