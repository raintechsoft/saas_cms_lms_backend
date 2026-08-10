import type { Request, Response } from "express";
import { z } from "zod";
import {
  cloneEmailGateway,
  deleteEmailGateway,
  deleteEmailTemplate,
  getEmailGatewaySetup,
  testEmailGateway,
  upsertEmailGateway,
  upsertEmailTemplate,
} from "./email-gateway.service.js";

const idParams = z.object({ id: z.string().min(1) });

const gatewayBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  host: z.string().trim().min(1).max(200),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  encryption: z.enum(["NONE", "STARTTLS", "SSL"]).optional(),
  username: z.string().trim().min(1).max(200),
  password: z.string().trim().max(2000).optional(),
  fromEmail: z.string().trim().email().max(200),
  fromName: z.string().trim().max(120).nullable().optional(),
  replyToEmail: z.string().trim().max(200).nullable().optional(),
  ccEmail: z.string().trim().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  balanceCredits: z.coerce.number().int().min(0).max(100_000_000).optional(),
});

const templateBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["TRANSACTIONAL", "PROMOTIONAL", "SYSTEM", "GENERAL"]).optional(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const testBody = z.object({
  id: z.string().min(1).optional(),
});

export async function getEmailGatewaySetupController(req: Request, res: Response) {
  res.json({ data: await getEmailGatewaySetup(req.auth!.tenantId!) });
}

export async function upsertEmailGatewayController(req: Request, res: Response) {
  const body = gatewayBody.parse(req.body);
  res.json({
    data: await upsertEmailGateway(req.auth!.tenantId!, {
      ...body,
      replyToEmail: body.replyToEmail || null,
      ccEmail: body.ccEmail || null,
    }),
  });
}

export async function cloneEmailGatewayController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await cloneEmailGateway(req.auth!.tenantId!, id) });
}

export async function deleteEmailGatewayController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteEmailGateway(req.auth!.tenantId!, id) });
}

export async function testEmailGatewayController(req: Request, res: Response) {
  const body = testBody.parse(req.body ?? {});
  res.json({ data: await testEmailGateway(req.auth!.tenantId!, body.id) });
}

export async function upsertEmailTemplateController(req: Request, res: Response) {
  res.json({
    data: await upsertEmailTemplate(req.auth!.tenantId!, templateBody.parse(req.body)),
  });
}

export async function deleteEmailTemplateController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteEmailTemplate(req.auth!.tenantId!, id) });
}
