import webpush from "web-push";
import { env, isPushEnvConfigured } from "../config/env.js";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!isPushEnvConfigured()) return;
  webpush.setVapidDetails(
    `mailto:${env.PUSH_CONTACT_EMAIL}`,
    env.PUSH_VAPID_PUBLIC_KEY!,
    env.PUSH_VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export function isPushConfigured() {
  ensureConfigured();
  return configured;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  type?: string;
};

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
) {
  ensureConfigured();
  if (!configured) return { delivered: false, statusCode: 0, reason: "push_not_configured" };

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 },
    );
    return { delivered: true, statusCode: 201 };
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 500;
    const reason = error instanceof Error ? error.message : "Push failed";
    return { delivered: false, statusCode, reason };
  }
}
