import { NotificationType, NoticeAudience } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { sendSms } from "../../lib/sms.js";
import {
  createNotification,
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  removePushSubscription,
  savePushSubscription,
  sendPushTestNotification,
  sendFeeOverdueReminders,
} from "./notifications.service.js";

const notificationIdParams = z.object({ id: z.string().min(1) });
const unreadResponse = z.object({ count: z.number() });

const createNotificationBody = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(2).max(10000),
  type: z.nativeEnum(NotificationType).optional(),
  audience: z.nativeEnum(NoticeAudience).optional(),
  classSectionId: z.string().min(1).nullable().optional(),
  targetUserId: z.string().min(1).nullable().optional(),
  sendEmail: z.boolean().optional(),
});

const feeOverdueBody = z.object({
  sessionId: z.string().min(1),
});

const pushSubscriptionBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const pushUnsubscribeBody = z.object({
  endpoint: z.string().url(),
});

export async function listNotificationsController(req: Request, res: Response) {
  const wantsAll = String(req.query.scope ?? "") === "all";
  const canManage = req.auth!.permissions.includes("notifications.manage");
  const parsedLimit = Number(req.query.limit ?? (wantsAll && canManage ? 200 : 30));
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 200)
    : 30;
  res.json({
    data: await listNotifications(req.auth!.tenantId!, req.auth!.userId, limit, {
      scope: wantsAll && canManage ? "all" : "inbox",
    }),
  });
}

export async function getUnreadCountController(req: Request, res: Response) {
  const count = await getUnreadCount(req.auth!.tenantId!, req.auth!.userId);
  res.json({ data: unreadResponse.parse({ count }) });
}

export async function createNotificationController(req: Request, res: Response) {
  res.status(201).json({
    data: await createNotification(req.auth!.tenantId!, req.auth!.userId, createNotificationBody.parse(req.body)),
  });
}

export async function markReadController(req: Request, res: Response) {
  const { id } = notificationIdParams.parse(req.params);
  await markRead(req.auth!.tenantId!, req.auth!.userId, id);
  res.status(204).send();
}

export async function markAllReadController(req: Request, res: Response) {
  res.json({ data: await markAllRead(req.auth!.tenantId!, req.auth!.userId) });
}

export async function sendFeeOverdueRemindersController(req: Request, res: Response) {
  const { sessionId } = feeOverdueBody.parse(req.body);
  const result = await sendFeeOverdueReminders(req.auth!.tenantId!, req.auth!.userId, sessionId);
  res.json({ data: result });
}

export async function subscribePushController(req: Request, res: Response) {
  const payload = pushSubscriptionBody.parse(req.body);
  const result = await savePushSubscription(
    req.auth!.tenantId!,
    req.auth!.userId,
    payload,
    req.get("user-agent") ?? undefined,
  );
  res.status(201).json({ data: result });
}

export async function unsubscribePushController(req: Request, res: Response) {
  const { endpoint } = pushUnsubscribeBody.parse(req.body);
  const result = await removePushSubscription(req.auth!.tenantId!, req.auth!.userId, endpoint);
  res.json({ data: result });
}

export async function testPushController(req: Request, res: Response) {
  const result = await sendPushTestNotification(req.auth!.tenantId!, req.auth!.userId);
  res.json({ data: result });
}

const sendSmsBody = z.object({
  to: z.string().trim().min(8).max(30),
  body: z.string().trim().min(1).max(1000),
  studentId: z.string().min(1).optional(),
});

export async function sendSmsController(req: Request, res: Response) {
  const body = sendSmsBody.parse(req.body);
  const result = await sendSms({
    tenantId: req.auth!.tenantId!,
    to: body.to,
    body: body.body,
  });
  res.json({ data: { ...result, studentId: body.studentId ?? null } });
}

