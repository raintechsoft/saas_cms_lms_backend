import type { Request, Response } from "express";
import { z } from "zod";
import {
  deleteWhatsAppTemplate,
  getWhatsAppGatewaySetup,
  saveWhatsAppGateway,
  sendWhatsAppTestMessage,
  testWhatsAppConnection,
  upsertWhatsAppTemplate,
  verifyWhatsAppWebhook,
} from "./whatsapp-gateway.service.js";

const idParams = z.object({ id: z.string().min(1) });

const gatewayBody = z.object({
  provider: z.string().trim().max(40).nullable().optional(),
  isEnabled: z.boolean().optional(),
  wabaId: z.string().trim().max(80).optional(),
  phoneNumberId: z.string().trim().max(80).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
  accessToken: z.string().trim().max(4000).optional(),
  verifyToken: z.string().trim().max(200).optional(),
  webhookEvents: z.array(z.string().trim().max(60)).max(20).optional(),
  businessHoursMode: z.enum(["always", "custom"]).optional(),
  defaultLanguage: z.string().trim().max(20).optional(),
  fallbackLanguage: z.string().trim().max(20).optional(),
  templateCategoryFilter: z.string().trim().max(40).optional(),
  messageQuotaLimit: z.coerce.number().int().min(0).max(10_000_000).optional(),
  messageQuotaUsed: z.coerce.number().int().min(0).max(10_000_000).optional(),
  previewSchoolName: z.string().trim().max(120).optional(),
  previewMessage: z.string().trim().max(1000).optional(),
});

const templateBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  language: z.string().trim().max(20).optional(),
  category: z.string().trim().max(40).optional(),
  body: z.string().trim().min(1).max(2000),
  status: z.enum(["APPROVED", "PENDING", "REJECTED", "ARCHIVED"]).optional(),
  isActive: z.boolean().optional(),
});

const testMessageBody = z.object({
  to: z.string().trim().min(8).max(40),
  message: z.string().trim().max(1000).optional(),
});

export async function getWhatsAppGatewaySetupController(req: Request, res: Response) {
  res.json({ data: await getWhatsAppGatewaySetup(req.auth!.tenantId!) });
}

export async function saveWhatsAppGatewayController(req: Request, res: Response) {
  res.json({
    data: await saveWhatsAppGateway(req.auth!.tenantId!, gatewayBody.parse(req.body)),
  });
}

export async function testWhatsAppConnectionController(req: Request, res: Response) {
  res.json({ data: await testWhatsAppConnection(req.auth!.tenantId!) });
}

export async function sendWhatsAppTestMessageController(req: Request, res: Response) {
  res.json({
    data: await sendWhatsAppTestMessage(
      req.auth!.tenantId!,
      testMessageBody.parse(req.body),
    ),
  });
}

export async function upsertWhatsAppTemplateController(req: Request, res: Response) {
  res.json({
    data: await upsertWhatsAppTemplate(req.auth!.tenantId!, templateBody.parse(req.body)),
  });
}

export async function deleteWhatsAppTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteWhatsAppTemplate(req.auth!.tenantId!, id) });
}

export async function verifyWhatsAppWebhookController(req: Request, res: Response) {
  const challenge = await verifyWhatsAppWebhook({
    mode: typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : undefined,
    verifyToken:
      typeof req.query["hub.verify_token"] === "string"
        ? req.query["hub.verify_token"]
        : undefined,
    challenge:
      typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : undefined,
  });
  res.status(200).send(challenge);
}

export async function receiveWhatsAppWebhookController(req: Request, res: Response) {
  // Acknowledge Meta webhook delivery; processing can be extended later.
  res.status(200).json({ success: true });
}
