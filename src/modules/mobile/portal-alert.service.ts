import { NoticeAudience } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { isPushConfigured, sendWebPush } from "../../lib/push.js";
import { collectAudienceUserIds } from "../notifications/push-audience.js";
import { sendMobilePushToUser, sendMobilePushToUsers } from "./mobile-push.service.js";
import {
  buildPortalPushPayload,
  type PortalAlertInput,
} from "./portal-alert.format.js";

export type DispatchPortalAlertOptions = {
  audience?: NoticeAudience;
  classSectionId?: string | null;
  targetUserId?: string | null;
};

async function collectTargetUserIds(
  tenantId: string,
  audience: NoticeAudience,
  options?: { classSectionId?: string | null; targetUserId?: string | null },
) {
  if (options?.targetUserId) return [options.targetUserId];

  return collectAudienceUserIds(tenantId, audience, options);
}

async function sendWebPushToUser(
  tenantId: string,
  userId: string,
  payload: ReturnType<typeof buildPortalPushPayload>,
) {
  if (!isPushConfigured()) return { delivered: 0, failed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { tenantId, userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  let delivered = 0;
  let failed = 0;
  for (const sub of subscriptions) {
    const result = await sendWebPush(sub, payload);
    if (result.delivered) {
      delivered += 1;
      continue;
    }
    failed += 1;
    if (result.statusCode === 404 || result.statusCode === 410) {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
    }
  }
  return { delivered, failed };
}

export async function dispatchPortalUserAlert(
  tenantId: string,
  userId: string,
  alert: PortalAlertInput,
) {
  const payload = buildPortalPushPayload(alert);
  const [web, mobile] = await Promise.all([
    sendWebPushToUser(tenantId, userId, payload),
    sendMobilePushToUser(tenantId, userId, payload),
  ]);

  return {
    delivered: web.delivered + mobile.delivered,
    failed: web.failed + mobile.failed,
    web,
    mobile,
  };
}

export async function dispatchPortalAudienceAlert(
  tenantId: string,
  alert: PortalAlertInput,
  options?: DispatchPortalAlertOptions,
) {
  const audience = options?.audience ?? NoticeAudience.ALL;
  const userIds = await collectTargetUserIds(tenantId, audience, options);
  if (!userIds.length) {
    return { delivered: 0, failed: 0, recipients: 0, web: { delivered: 0, failed: 0 }, mobile: { delivered: 0, failed: 0, deviceCount: 0 } };
  }

  const payload = buildPortalPushPayload(alert);

  const subscriptions = isPushConfigured()
    ? await prisma.pushSubscription.findMany({
        where: { tenantId, userId: { in: userIds } },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      })
    : [];

  let webDelivered = 0;
  let webFailed = 0;
  for (const sub of subscriptions) {
    const result = await sendWebPush(sub, payload);
    if (result.delivered) {
      webDelivered += 1;
      continue;
    }
    webFailed += 1;
    if (result.statusCode === 404 || result.statusCode === 410) {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
    }
  }

  const mobile = await sendMobilePushToUsers(tenantId, userIds, payload);

  return {
    delivered: webDelivered + mobile.delivered,
    failed: webFailed + mobile.failed,
    recipients: userIds.length,
    web: { delivered: webDelivered, failed: webFailed },
    mobile,
  };
}

export async function getTenantDisplayName(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return tenant?.name ?? null;
}
