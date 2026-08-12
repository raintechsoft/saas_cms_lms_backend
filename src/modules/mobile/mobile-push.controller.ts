import type { Request, Response } from "express";
import { z } from "zod";
import {
  registerMobilePushToken,
  sendMobilePushTestNotification,
  unregisterMobilePushToken,
} from "./mobile-push.service.js";

const registerBody = z.object({
  token: z.string().trim().min(20).max(4096),
  platform: z.enum(["android", "ios"]).optional(),
});

const unregisterBody = z.object({
  token: z.string().trim().min(20).max(4096),
});

export async function registerMobilePushController(req: Request, res: Response) {
  const payload = registerBody.parse(req.body);
  const result = await registerMobilePushToken(
    req.auth!.tenantId!,
    req.auth!.userId,
    payload.token,
    payload.platform ?? "android",
  );
  res.status(201).json({ data: result });
}

export async function unregisterMobilePushController(req: Request, res: Response) {
  const { token } = unregisterBody.parse(req.body);
  const result = await unregisterMobilePushToken(
    req.auth!.tenantId!,
    req.auth!.userId,
    token,
  );
  res.json({ data: result });
}

export async function testMobilePushController(req: Request, res: Response) {
  const result = await sendMobilePushTestNotification(req.auth!.tenantId!, req.auth!.userId);
  res.json({ data: result });
}
