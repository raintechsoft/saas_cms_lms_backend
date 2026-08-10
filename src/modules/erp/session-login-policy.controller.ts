import type { Request, Response } from "express";
import { z } from "zod";
import {
  getSessionLoginPolicySetup,
  saveSessionLoginPolicy,
  terminateLoginSession,
  terminateOtherLoginSessions,
} from "./session-login-policy.service.js";

const saveBody = z.object({
  sessionTimeoutMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  warningBeforeLogoutMinutes: z.coerce.number().int().min(0).max(120).optional(),
  forceLogoutOtherDevices: z.boolean().optional(),
  rememberMeEnabled: z.boolean().optional(),
  autoLogoutOnBrowserClose: z.boolean().optional(),
  maxLoginAttempts: z.coerce.number().int().min(1).max(20).optional(),
  lockoutDurationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  lockAccountAfterMaxAttempts: z.boolean().optional(),
  notifyAdminOnLock: z.boolean().optional(),
  captchaOnLogin: z.boolean().optional(),
  minPasswordLength: z.coerce.number().int().min(6).max(64).optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  requireNumbers: z.boolean().optional(),
  requireSpecialChars: z.boolean().optional(),
  passwordExpiryDays: z.coerce.number().int().min(0).max(3650).optional(),
  preventPasswordReuseLast: z.coerce.number().int().min(0).max(24).optional(),
  allowedIpAddresses: z.string().max(5000).nullable().optional(),
  blockedIpAddresses: z.string().max(5000).nullable().optional(),
  restrictToAllowedIps: z.boolean().optional(),
});

const idParams = z.object({ id: z.string().min(1) });

export async function getSessionLoginPolicySetupController(req: Request, res: Response) {
  res.json({ data: await getSessionLoginPolicySetup(req.auth!.tenantId!) });
}

export async function saveSessionLoginPolicyController(req: Request, res: Response) {
  res.json({
    data: await saveSessionLoginPolicy(req.auth!.tenantId!, saveBody.parse(req.body)),
  });
}

export async function terminateLoginSessionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await terminateLoginSession(req.auth!.tenantId!, id) });
}

export async function terminateOtherLoginSessionsController(req: Request, res: Response) {
  res.json({ data: await terminateOtherLoginSessions(req.auth!.tenantId!) });
}
