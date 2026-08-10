import type { Request, Response } from "express";
import { z } from "zod";
import {
  getStudentAccessSettingsSetup,
  updateStudentAccessSettings,
} from "./student-access-settings.service.js";

const optionalDate = z
  .union([z.coerce.date(), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value));

const settingsBody = z.object({
  disableStudentLogin: z.boolean().optional(),
  allowProfileEditing: z.boolean().optional(),
  profileEditFrom: optionalDate,
  profileEditTo: optionalDate,
  selectedClassIds: z.array(z.string().min(1)).optional(),
  enabledPermissions: z.array(z.string().trim().min(1).max(60)).optional(),
});

export async function getStudentAccessSettingsController(req: Request, res: Response) {
  res.json({ data: await getStudentAccessSettingsSetup(req.auth!.tenantId!) });
}

export async function updateStudentAccessSettingsController(req: Request, res: Response) {
  res.json({
    data: await updateStudentAccessSettings(req.auth!.tenantId!, settingsBody.parse(req.body)),
  });
}
