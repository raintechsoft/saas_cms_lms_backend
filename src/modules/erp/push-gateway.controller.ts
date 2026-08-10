import type { Request, Response } from "express";
import { z } from "zod";
import {
  deletePushTopic,
  getPushGatewaySetup,
  savePushGateway,
  testPushGateway,
  upsertPushTopic,
} from "./push-gateway.service.js";

const idParams = z.object({ id: z.string().min(1) });

const gatewayBody = z.object({
  provider: z.string().trim().max(40).nullable().optional(),
  isEnabled: z.boolean().optional(),
  serverKey: z.string().trim().max(4000).optional(),
  webApiKey: z.string().trim().max(4000).optional(),
  senderId: z.string().trim().max(80).optional(),
  projectId: z.string().trim().max(120).optional(),
  androidEnabled: z.boolean().optional(),
  iosEnabled: z.boolean().optional(),
  webEnabled: z.boolean().optional(),
  defaultTitle: z.string().trim().max(120).optional(),
  defaultIconUrl: z.string().trim().max(500).optional(),
  defaultClickAction: z.string().trim().max(80).optional(),
  defaultSound: z.string().trim().max(80).optional(),
  showBadge: z.boolean().optional(),
  requireConsent: z.boolean().optional(),
});

const topicBody = z.object({
  id: z.string().min(1).optional(),
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  subscriberCount: z.coerce.number().int().min(0).max(10_000_000).optional(),
});

export async function getPushGatewaySetupController(req: Request, res: Response) {
  res.json({ data: await getPushGatewaySetup(req.auth!.tenantId!) });
}

export async function savePushGatewayController(req: Request, res: Response) {
  res.json({
    data: await savePushGateway(req.auth!.tenantId!, gatewayBody.parse(req.body)),
  });
}

export async function testPushGatewayController(req: Request, res: Response) {
  res.json({ data: await testPushGateway(req.auth!.tenantId!) });
}

export async function upsertPushTopicController(req: Request, res: Response) {
  res.json({
    data: await upsertPushTopic(req.auth!.tenantId!, topicBody.parse(req.body)),
  });
}

export async function deletePushTopicController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deletePushTopic(req.auth!.tenantId!, id) });
}
