import type { Request, Response } from "express";
import { z } from "zod";
import {
  getShortcutKeysSetup,
  resetShortcutKeys,
  saveShortcutKeys,
} from "./shortcut-keys.service.js";

const saveBody = z.object({
  shortcuts: z
    .array(
      z.object({
        actionKey: z.string().trim().min(1).max(80),
        shortcut: z.string().trim().min(1).max(50),
        isEnabled: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(200),
});

const resetBody = z.object({
  actionKey: z.string().trim().min(1).max(80).optional(),
});

export async function getShortcutKeysSetupController(req: Request, res: Response) {
  res.json({ data: await getShortcutKeysSetup(req.auth!.tenantId!) });
}

export async function saveShortcutKeysController(req: Request, res: Response) {
  const body = saveBody.parse(req.body);
  res.json({
    data: await saveShortcutKeys(req.auth!.tenantId!, body.shortcuts),
  });
}

export async function resetShortcutKeysController(req: Request, res: Response) {
  const body = resetBody.parse(req.body ?? {});
  res.json({
    data: await resetShortcutKeys(req.auth!.tenantId!, body.actionKey),
  });
}
