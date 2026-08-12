import { AppError } from "../../lib/errors.js";
import { isFcmConfigured, sendFcm } from "../../lib/fcm.js";
import { prisma } from "../../lib/prisma.js";
import { buildPortalPushPayload } from "./portal-alert.format.js";

export type MobilePushPayload = {
  title: string;
  body: string;
  url?: string;
  type?: string;
  screen?: string;
  category?: string;
  referenceId?: string;
  imageUrl?: string;
};

export function isMobilePushConfigured() {
  return isFcmConfigured();
}

export async function registerMobilePushToken(
  tenantId: string,
  userId: string,
  token: string,
  platform = "android",
) {
  const normalizedToken = token.trim();
  const normalizedPlatform = platform.trim().toLowerCase() || "android";
  if (!normalizedToken) {
    throw new AppError(400, "Invalid FCM token", "INVALID_FCM_TOKEN");
  }

  return prisma.mobilePushToken.upsert({
    where: { tenantId_token: { tenantId, token: normalizedToken } },
    create: {
      tenantId,
      userId,
      token: normalizedToken,
      platform: normalizedPlatform,
    },
    update: { userId, platform: normalizedPlatform },
    select: { id: true, platform: true, updatedAt: true },
  });
}

export async function unregisterMobilePushToken(
  tenantId: string,
  userId: string,
  token: string,
) {
  const result = await prisma.mobilePushToken.deleteMany({
    where: { tenantId, userId, token: token.trim() },
  });
  return { removed: result.count };
}

async function sendToTokenRows(
  tokens: Array<{ id: string; token: string }>,
  payload: MobilePushPayload,
) {
  if (!tokens.length || !isMobilePushConfigured()) {
    return { delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;
  for (const row of tokens) {
    const result = await sendFcm(row.token, payload);
    if (result.delivered) {
      delivered += 1;
      continue;
    }

    failed += 1;
    const invalid =
      result.code === "messaging/registration-token-not-registered" ||
      result.code === "messaging/invalid-registration-token";
    if (invalid) {
      await prisma.mobilePushToken.delete({ where: { id: row.id } }).catch(() => undefined);
    }
  }

  return { delivered, failed };
}

export async function sendMobilePushToUser(
  tenantId: string,
  userId: string,
  payload: MobilePushPayload,
) {
  const tokens = await prisma.mobilePushToken.findMany({
    where: { tenantId, userId },
    select: { id: true, token: true },
  });

  const result = await sendToTokenRows(tokens, payload);
  return { ...result, deviceCount: tokens.length };
}

export async function sendMobilePushToUsers(
  tenantId: string,
  userIds: string[],
  payload: MobilePushPayload,
) {
  if (!userIds.length) return { delivered: 0, failed: 0, deviceCount: 0 };

  const tokens = await prisma.mobilePushToken.findMany({
    where: { tenantId, userId: { in: userIds } },
    select: { id: true, token: true },
  });

  const result = await sendToTokenRows(tokens, payload);
  return { ...result, deviceCount: tokens.length };
}

export async function sendMobilePushTestNotification(
  tenantId: string,
  userId: string,
) {
  if (!isMobilePushConfigured()) {
    throw new AppError(
      400,
      "Mobile push is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON to the backend.",
      "MOBILE_PUSH_NOT_CONFIGURED",
    );
  }

  return sendMobilePushToUser(
    tenantId,
    userId,
    buildPortalPushPayload({
      category: "GENERAL",
      title: "Mobile push enabled",
      body: "This is a test alert from the Student & Parent app.",
      type: "ANNOUNCEMENT",
      screen: "notifications",
    }),
  );
}
