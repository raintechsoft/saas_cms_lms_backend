import type { Request, Response } from "express";
import { z } from "zod";
import {
  cloneSmsTemplate,
  deleteSmsTemplate,
  getSmsGatewaySetup,
  saveSmsGateway,
  testSmsGateway,
  upsertSmsTemplate,
} from "./sms-gateway.service.js";

const idParams = z.object({ id: z.string().min(1) });

const gatewayBody = z.object({
  provider: z.string().trim().max(40).nullable().optional(),
  isEnabled: z.boolean(),
  gatewayName: z.string().trim().max(120).optional(),
  senderId: z.string().trim().max(20).optional(),
  country: z.string().trim().max(10).optional(),
  route: z.string().trim().max(10).optional(),
  templateId: z.string().trim().max(120).optional(),
  balanceCredits: z.coerce.number().int().min(0).max(100_000_000).optional(),
  authKey: z.string().trim().max(2000).optional(),
  apiSecret: z.string().trim().max(2000).optional(),
});

const templateBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["TRANSACTIONAL", "PROMOTIONAL", "OTP", "ALERT", "GENERAL"]).optional(),
  body: z.string().trim().min(1).max(1000),
  providerCode: z.string().trim().max(120).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function getSmsGatewaySetupController(req: Request, res: Response) {
  res.json({ data: await getSmsGatewaySetup(req.auth!.tenantId!) });
}

export async function saveSmsGatewayController(req: Request, res: Response) {
  res.json({
    data: await saveSmsGateway(req.auth!.tenantId!, gatewayBody.parse(req.body)),
  });
}

export async function testSmsGatewayController(req: Request, res: Response) {
  res.json({ data: await testSmsGateway(req.auth!.tenantId!) });
}

export async function upsertSmsTemplateController(req: Request, res: Response) {
  res.json({
    data: await upsertSmsTemplate(req.auth!.tenantId!, templateBody.parse(req.body)),
  });
}

export async function cloneSmsTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await cloneSmsTemplate(req.auth!.tenantId!, id) });
}

export async function deleteSmsTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteSmsTemplate(req.auth!.tenantId!, id) });
}
