import admin from "firebase-admin";
import { loadFirebaseServiceAccountJson } from "../config/env.js";

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  const raw = loadFirebaseServiceAccountJson();
  if (!raw) return;

  try {
    const credentials = JSON.parse(raw) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
    initialized = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "FCM init failed";
    console.error(`[fcm] Failed to initialize Firebase Admin: ${message}`);
  }
}

export function isFcmConfigured() {
  ensureInitialized();
  return initialized;
}

export type FcmPayload = {
  title: string;
  body: string;
  url?: string;
  type?: string;
  screen?: string;
  category?: string;
  referenceId?: string;
  imageUrl?: string;
};

async function deliverFcm(token: string, payload: FcmPayload) {
  await admin.messaging().send({
    token,
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    data: {
      ...(payload.type ? { type: String(payload.type) } : {}),
      ...(payload.screen ? { screen: String(payload.screen) } : {}),
      ...(payload.category ? { category: String(payload.category) } : {}),
      ...(payload.referenceId ? { referenceId: String(payload.referenceId) } : {}),
      ...(payload.url ? { url: String(payload.url) } : {}),
      ...(payload.imageUrl ? { imageUrl: String(payload.imageUrl) } : {}),
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
    android: {
      priority: "high",
      notification: {
        channelId: "portal_alerts",
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
    },
    apns: {
      fcmOptions: payload.imageUrl ? { imageUrl: payload.imageUrl } : undefined,
      payload: {
        aps: {
          sound: "default",
          mutableContent: payload.imageUrl ? true : undefined,
        },
      },
    },
  });
}

export async function sendFcm(token: string, payload: FcmPayload) {
  ensureInitialized();
  if (!initialized) {
    return { delivered: false as const, reason: "fcm_not_configured" };
  }

  try {
    await deliverFcm(token, payload);
    return { delivered: true as const };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "FCM send failed";
    const code = (error as { code?: string })?.code;

    if (payload.imageUrl) {
      try {
        const { imageUrl: _image, ...rest } = payload;
        await deliverFcm(token, rest);
        console.warn(
          `[fcm] Retried without image (${payload.category ?? payload.type ?? "alert"}): ${reason}`,
        );
        return { delivered: true as const, retriedWithoutImage: true as const };
      } catch (retryError) {
        const retryReason =
          retryError instanceof Error ? retryError.message : "FCM retry failed";
        const retryCode = (retryError as { code?: string })?.code;
        return { delivered: false as const, reason: retryReason, code: retryCode };
      }
    }

    return { delivered: false as const, reason, code };
  }
}
