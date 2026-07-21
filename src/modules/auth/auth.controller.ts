import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import { publicUploadPath } from "../../lib/uploads.js";
import {
  forgotPassword,
  getAuthPublicConfig,
  getCurrentUser,
  login,
  loginWithGoogle,
  requestLoginOtp,
  resetPassword,
  updateOwnAvatar,
  updateOwnProfile,
  verifyLoginOtp,
} from "./auth.service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().min(2).max(100).optional(),
});

const tenantScopedSchema = z.object({
  email: z.string().email(),
  tenantSlug: z.string().min(2).max(100).optional(),
});

const verifyOtpSchema = tenantScopedSchema.extend({
  code: z.string().min(4).max(64),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(16),
  password: z.string().min(8),
  tenantSlug: z.string().min(2).max(100).optional(),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(20),
  tenantSlug: z.string().min(2).max(100).optional(),
});

const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

export async function loginController(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await login(input);
  res.json({ data: result });
}

export async function meController(req: Request, res: Response) {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({
      error: { code: "AUTH_REQUIRED", message: "Bearer access token required" },
    });
    return;
  }
  res.json({ data: await getCurrentUser(token) });
}

export async function updateProfileController(req: Request, res: Response) {
  const input = profileUpdateSchema.parse(req.body);
  const data = await updateOwnProfile(req.auth!.userId, input);
  res.json({ data });
}

export async function uploadAvatarController(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    throw new AppError(400, "Image file is required", "FILE_REQUIRED");
  }
  const avatarUrl = publicUploadPath(file.filename);
  const data = await updateOwnAvatar(req.auth!.userId, avatarUrl);
  res.json({ data });
}

export async function authConfigController(_req: Request, res: Response) {
  res.json({ data: getAuthPublicConfig() });
}

export async function requestOtpController(req: Request, res: Response) {
  const input = tenantScopedSchema.parse(req.body);
  res.json({ data: await requestLoginOtp(input) });
}

export async function verifyOtpController(req: Request, res: Response) {
  const input = verifyOtpSchema.parse(req.body);
  const result = await verifyLoginOtp(input);
  res.json({ data: result });
}

export async function forgotPasswordController(req: Request, res: Response) {
  const input = tenantScopedSchema.parse(req.body);
  res.json({ data: await forgotPassword(input) });
}

export async function resetPasswordController(req: Request, res: Response) {
  const input = resetPasswordSchema.parse(req.body);
  res.json({ data: await resetPassword(input) });
}

export async function googleLoginController(req: Request, res: Response) {
  const input = googleLoginSchema.parse(req.body);
  const result = await loginWithGoogle(input);
  res.json({ data: result });
}
