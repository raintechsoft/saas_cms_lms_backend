import { env, isTwilioEnvConfigured } from "../config/env.js";
import { AppError } from "./errors.js";
import { getTenantIntegration } from "../modules/erp/erp.service.js";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Normalize common Indian/local numbers to E.164 for Twilio. */
export function normalizeSmsNumber(raw: string) {
  let value = raw.trim().replace(/[\s()-]/g, "");
  if (!value) return "";
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (value.startsWith("+")) return value;
  if (/^91\d{10}$/.test(value)) return `+${value}`;
  if (/^\d{10}$/.test(value)) return `+91${value}`;
  return value.startsWith("+") ? value : `+${value}`;
}

async function resolveTwilioCredentials(tenantId: string) {
  const envCreds = isTwilioEnvConfigured()
    ? {
        accountSid: env.TWILIO_ACCOUNT_SID!,
        authToken: env.TWILIO_AUTH_TOKEN!,
        fromNumber: normalizeSmsNumber(env.TWILIO_FROM_NUMBER!),
        source: "env" as const,
      }
    : null;

  const integration = await getTenantIntegration(tenantId, "SMS");
  if (integration?.isEnabled) {
    const config = (integration.config ?? {}) as Record<string, unknown>;
    const secrets = integration.secrets ?? {};
    const accountSid = asString(
      secrets.accountSid ?? secrets.sid ?? config.accountSid ?? config.sid,
    );
    const authToken = asString(
      secrets.authToken ?? secrets.token ?? config.authToken ?? config.token,
    );
    const fromNumber = normalizeSmsNumber(
      asString(config.fromNumber ?? config.from ?? secrets.fromNumber ?? secrets.from),
    );
    // Twilio Account SIDs start with "AC". Skip bad ERP values so .env can be used.
    const looksValid = accountSid.startsWith("AC") && authToken.length > 10 && Boolean(fromNumber);
    if (looksValid) {
      return { accountSid, authToken, fromNumber, source: "erp" as const };
    }
    if (accountSid || authToken || fromNumber) {
      console.warn(
        "[sms] ERP SMS is enabled but credentials look invalid (Account SID should start with AC). Falling back to .env if set.",
      );
    }
  }

  return envCreds;
}

export function isSmsConfigured() {
  return isTwilioEnvConfigured();
}

export async function sendSms(input: {
  tenantId: string;
  to: string;
  body: string;
}) {
  const to = normalizeSmsNumber(input.to);
  const body = input.body.trim();

  if (!to) {
    throw new AppError(400, "SMS phone number is empty", "SMS_INVALID_TO");
  }

  const credentials = await resolveTwilioCredentials(input.tenantId);
  if (!credentials) {
    if (env.NODE_ENV === "production") {
      throw new AppError(503, "SMS delivery is not configured", "SMS_NOT_CONFIGURED");
    }
    console.info("[sms] Twilio not configured (ERP SMS or TWILIO_* env) — delivery skipped");
    console.info(`[sms] To: ${to}`);
    console.info(`[sms] Body: ${body}`);
    return { delivered: false as const };
  }

  const { accountSid, authToken, fromNumber, source } = credentials;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    console.error(`[sms] Twilio failed to=${to} source=${source}: ${text}`);
    throw new AppError(502, "Failed to send SMS", "SMS_SEND_FAILED");
  }
  console.info(`[sms] Delivered to ${to} (via ${source})`);
  return { delivered: true as const };
}
