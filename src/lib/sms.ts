import { env, isMsg91EnvConfigured } from "../config/env.js";
import { AppError } from "./errors.js";
import { getTenantIntegration } from "../modules/erp/erp.service.js";
import { logSmsDelivery } from "../modules/erp/sms-gateway.service.js";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Normalize to E.164 (+91XXXXXXXXXX) for storage/display. */
export function normalizeSmsNumber(raw: string) {
  let value = raw.trim().replace(/[\s()-]/g, "");
  if (!value) return "";
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (value.startsWith("+")) return value;
  if (/^91\d{10}$/.test(value)) return `+${value}`;
  if (/^\d{10}$/.test(value)) return `+91${value}`;
  return value.startsWith("+") ? value : `+${value}`;
}

/** MSG91 expects digits with country code, no "+". */
export function toMsg91Mobile(raw: string) {
  const e164 = normalizeSmsNumber(raw);
  return e164.replace(/^\+/, "");
}

type Msg91Credentials = {
  authKey: string;
  senderId: string;
  templateId: string;
  source: "env" | "erp";
};

async function resolveMsg91Credentials(tenantId: string): Promise<Msg91Credentials | null> {
  const envCreds = isMsg91EnvConfigured()
    ? {
        authKey: env.MSG91_AUTH_KEY!,
        senderId: env.MSG91_SENDER_ID!,
        templateId: env.MSG91_TEMPLATE_ID ?? "",
        source: "env" as const,
      }
    : null;

  const integration = await getTenantIntegration(tenantId, "SMS");
  if (integration?.isEnabled) {
    const config = (integration.config ?? {}) as Record<string, unknown>;
    const secrets = integration.secrets ?? {};
    const authKey = asString(
      secrets.authKey ?? secrets.authkey ?? secrets.apiKey ?? config.authKey ?? config.authkey,
    );
    const senderId = asString(
      config.senderId ?? config.sender ?? secrets.senderId ?? secrets.sender,
    ).toUpperCase();
    const templateId = asString(
      config.templateId ?? config.flowId ?? config.template_id ?? config.flow_id ?? secrets.templateId,
    );
    const looksValid = authKey.length >= 16 && senderId.length >= 3;
    if (looksValid) {
      return { authKey, senderId, templateId, source: "erp" };
    }
    if (authKey || senderId || templateId) {
      console.warn(
        "[sms] ERP SMS is enabled but MSG91 credentials look invalid. Falling back to .env if set.",
      );
    }
  }

  return envCreds;
}

export function isSmsConfigured() {
  return isMsg91EnvConfigured();
}

async function sendViaFlow(input: {
  authKey: string;
  senderId: string;
  templateId: string;
  mobile: string;
  body: string;
}) {
  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: input.authKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: input.templateId,
      sender: input.senderId,
      short_url: "0",
      recipients: [
        {
          mobiles: input.mobile,
          // Common DLT template placeholders — map message body into VAR1
          VAR1: input.body,
          var: input.body,
        },
      ],
    }),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

async function sendViaHttp(input: {
  authKey: string;
  senderId: string;
  mobile: string;
  body: string;
}) {
  const url = new URL("https://api.msg91.com/api/sendhttp.php");
  url.searchParams.set("authkey", input.authKey);
  url.searchParams.set("mobiles", input.mobile);
  url.searchParams.set("message", input.body);
  url.searchParams.set("sender", input.senderId);
  url.searchParams.set("route", "4");
  url.searchParams.set("country", "91");

  const response = await fetch(url, { method: "GET" });
  const text = await response.text();
  // sendhttp returns a request id (digits) on success, or an error string
  const ok = response.ok && /^\d+$/.test(text.trim());
  return { ok, status: response.status, text };
}

export async function sendSms(input: {
  tenantId: string;
  to: string;
  body: string;
  category?: string;
}) {
  const to = normalizeSmsNumber(input.to);
  const mobile = toMsg91Mobile(input.to);
  const body = input.body.trim();

  if (!to || !mobile) {
    throw new AppError(400, "SMS phone number is empty", "SMS_INVALID_TO");
  }

  const credentials = await resolveMsg91Credentials(input.tenantId);
  if (!credentials) {
    await logSmsDelivery({
      tenantId: input.tenantId,
      toNumber: to,
      body,
      status: "SKIPPED",
      provider: null,
      category: input.category ?? "GENERAL",
      errorMessage: "SMS not configured",
    }).catch(() => undefined);
    if (env.NODE_ENV === "production") {
      throw new AppError(503, "SMS delivery is not configured", "SMS_NOT_CONFIGURED");
    }
    console.info("[sms] MSG91 not configured (ERP SMS or MSG91_* env) — delivery skipped");
    console.info(`[sms] To: ${to}`);
    console.info(`[sms] Body: ${body}`);
    return { delivered: false as const };
  }

  const { authKey, senderId, templateId, source } = credentials;
  const result = templateId
    ? await sendViaFlow({ authKey, senderId, templateId, mobile, body })
    : await sendViaHttp({ authKey, senderId, mobile, body });

  if (!result.ok) {
    console.error(`[sms] MSG91 failed to=${mobile} source=${source}: ${result.text}`);
    await logSmsDelivery({
      tenantId: input.tenantId,
      toNumber: to,
      body,
      status: "FAILED",
      provider: "msg91",
      category: input.category ?? "GENERAL",
      errorMessage: result.text.slice(0, 500),
    }).catch(() => undefined);
    throw new AppError(502, "Failed to send SMS", "SMS_SEND_FAILED");
  }

  await logSmsDelivery({
    tenantId: input.tenantId,
    toNumber: to,
    body,
    status: "SUCCESS",
    provider: "msg91",
    category: input.category ?? "GENERAL",
  }).catch(() => undefined);

  console.info(`[sms] Delivered to ${mobile} via MSG91 (${source}${templateId ? ", flow" : ", http"})`);
  return { delivered: true as const };
}
