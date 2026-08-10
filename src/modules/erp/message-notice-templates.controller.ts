import type { Request, Response } from "express";
import { z } from "zod";
import {
  deleteMessageNoticeTemplate,
  getMessageNoticeTemplatesSetup,
  toggleMessageNoticeTemplate,
  upsertMessageNoticeTemplate,
} from "./message-notice-templates.service.js";

const idParams = z.object({ id: z.string().min(1) });

const templateBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  type: z.enum(["MESSAGE", "NOTICE", "EMAIL"]),
  category: z.string().trim().min(1).max(80),
  language: z.string().trim().max(20).optional(),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1).max(8000),
  channelWhatsapp: z.boolean().optional(),
  channelSms: z.boolean().optional(),
  channelPush: z.boolean().optional(),
  channelEmail: z.boolean().optional(),
  isActive: z.boolean().optional(),
  usedInTriggers: z.boolean().optional(),
});

const toggleBody = z.object({
  isActive: z.boolean().optional(),
});

export async function getMessageNoticeTemplatesSetupController(req: Request, res: Response) {
  res.json({ data: await getMessageNoticeTemplatesSetup(req.auth!.tenantId!) });
}

export async function upsertMessageNoticeTemplateController(req: Request, res: Response) {
  res.json({
    data: await upsertMessageNoticeTemplate(req.auth!.tenantId!, templateBody.parse(req.body)),
  });
}

export async function toggleMessageNoticeTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = toggleBody.parse(req.body ?? {});
  res.json({
    data: await toggleMessageNoticeTemplate(req.auth!.tenantId!, id, body.isActive),
  });
}

export async function deleteMessageNoticeTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteMessageNoticeTemplate(req.auth!.tenantId!, id) });
}
