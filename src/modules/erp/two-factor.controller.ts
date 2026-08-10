import type { Request, Response } from "express";
import { z } from "zod";
import { getTwoFactorSetup, saveTwoFactorSettings } from "./two-factor.service.js";

const saveBody = z.object({
  enabled: z.boolean().optional(),
  methodTotp: z.boolean().optional(),
  methodSms: z.boolean().optional(),
  methodEmail: z.boolean().optional(),
  methodBackupCodes: z.boolean().optional(),
  enforcedRoleCodes: z.array(z.string().min(1).max(60)).max(20).optional(),
  optionalRoleCodes: z.array(z.string().min(1).max(60)).max(20).optional(),
  gracePeriodDays: z.coerce.number().int().min(0).max(90).optional(),
  requireOnNewDevices: z.boolean().optional(),
  rememberDeviceDays: z.coerce.number().int().min(0).max(365).optional(),
  maxAttemptsWithout2fa: z.coerce.number().int().min(1).max(20).optional(),
  generateBackupCodes: z.boolean().optional(),
  backupCodesCount: z.coerce.number().int().optional(),
  totpIssuer: z.string().trim().max(80).optional(),
  smsCodeExpirySeconds: z.coerce.number().int().min(60).max(3600).optional(),
  emailCodeExpirySeconds: z.coerce.number().int().min(60).max(3600).optional(),
});

export async function getTwoFactorSetupController(req: Request, res: Response) {
  res.json({ data: await getTwoFactorSetup(req.auth!.tenantId!) });
}

export async function saveTwoFactorSettingsController(req: Request, res: Response) {
  res.json({
    data: await saveTwoFactorSettings(req.auth!.tenantId!, saveBody.parse(req.body)),
  });
}
