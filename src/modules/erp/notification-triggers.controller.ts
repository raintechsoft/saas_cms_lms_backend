import type { Request, Response } from "express";
import { z } from "zod";
import {
  deleteNotificationTrigger,
  getNotificationTriggersSetup,
  testNotificationTrigger,
  toggleNotificationTrigger,
  upsertNotificationTrigger,
} from "./notification-triggers.service.js";

const idParams = z.object({ id: z.string().min(1) });

const moduleEnum = z.enum([
  "ADMISSION",
  "FEES",
  "ACADEMICS",
  "EXAMINATIONS",
  "ATTENDANCE",
  "HR",
  "GENERAL",
]);

const triggerBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  module: moduleEnum,
  eventKey: z.string().trim().min(1).max(80),
  eventLabel: z.string().trim().min(1).max(160),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  sendTiming: z.enum(["IMMEDIATELY", "SCHEDULED", "QUIET_HOURS"]).optional(),
  channelWhatsapp: z.boolean().optional(),
  channelEmail: z.boolean().optional(),
  channelPush: z.boolean().optional(),
  channelSms: z.boolean().optional(),
  recipientStudent: z.boolean().optional(),
  recipientParent: z.boolean().optional(),
  recipientStaff: z.boolean().optional(),
  messageSubject: z.string().trim().max(200).nullable().optional(),
  messageBody: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().optional(),
  isScheduledToday: z.boolean().optional(),
});

const toggleBody = z.object({
  isActive: z.boolean().optional(),
});

export async function getNotificationTriggersSetupController(req: Request, res: Response) {
  res.json({ data: await getNotificationTriggersSetup(req.auth!.tenantId!) });
}

export async function upsertNotificationTriggerController(req: Request, res: Response) {
  res.json({
    data: await upsertNotificationTrigger(req.auth!.tenantId!, triggerBody.parse(req.body)),
  });
}

export async function toggleNotificationTriggerController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = toggleBody.parse(req.body ?? {});
  res.json({
    data: await toggleNotificationTrigger(req.auth!.tenantId!, id, body.isActive),
  });
}

export async function deleteNotificationTriggerController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteNotificationTrigger(req.auth!.tenantId!, id) });
}

export async function testNotificationTriggerController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await testNotificationTrigger(req.auth!.tenantId!, id) });
}
