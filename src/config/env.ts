import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/** Prisma-side pool. Render + Supabase PgBouncer cannot serve parallel queries with connection_limit=1 (P2024). */
function withPrismaPoolSettings(raw: string): string {
  try {
    const parsed = new URL(raw);
    const limit = Number(parsed.searchParams.get("connection_limit") || "0");
    if (!Number.isFinite(limit) || limit < 5) {
      parsed.searchParams.set("connection_limit", "10");
    }
    const timeout = Number(parsed.searchParams.get("pool_timeout") || "0");
    if (!Number.isFinite(timeout) || timeout < 20) {
      parsed.searchParams.set("pool_timeout", "20");
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function rewriteSupabaseDatabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  const directMatch = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (directMatch) {
    const projectRef = directMatch[1];
    const region = process.env.SUPABASE_POOLER_REGION?.trim() || "ap-southeast-1";
    parsed.hostname = `aws-0-${region}.pooler.supabase.com`;
    parsed.port = "6543";
    const user = decodeURIComponent(parsed.username || "postgres");
    if (user === "postgres" || !user.includes(".")) {
      parsed.username = `postgres.${projectRef}`;
    }
    parsed.searchParams.set("pgbouncer", "true");
    parsed.searchParams.set("sslmode", "require");
    const rewritten = withPrismaPoolSettings(parsed.toString());
    console.warn(
      `[database] Rewrote direct Supabase host db.${projectRef}.supabase.co:5432 → ${parsed.hostname}:6543`,
    );
    return rewritten;
  }

  if (/supabase\.(co|com)/i.test(trimmed)) {
    if (!parsed.searchParams.has("sslmode")) parsed.searchParams.set("sslmode", "require");
    return withPrismaPoolSettings(parsed.toString());
  }

  return withPrismaPoolSettings(trimmed);
}

{
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = rewriteSupabaseDatabaseUrl(process.env.DATABASE_URL);
  }
}

// Accept common MSG91 env aliases (Windows/.env casing variants).
{
  const authKey =
    process.env.MSG91_AUTH_KEY ||
    process.env.Msg91_AUTH_KEY ||
    process.env.MSG91_AUTHKEY ||
    process.env.MSG91_API_KEY ||
    "";
  const senderId =
    process.env.MSG91_SENDER_ID ||
    process.env.Msg91_SENDER_ID ||
    process.env.MSG91_SENDER ||
    "";
  const templateId =
    process.env.MSG91_TEMPLATE_ID ||
    process.env.Msg91_TEMPLATE_ID ||
    process.env.MSG91_FLOW_ID ||
    "";
  const widgetId =
    process.env.MSG91_WIDGET_ID ||
    process.env.Msg91_WIDGET_ID ||
    "";
  const tokenAuth =
    process.env.MSG91_TOKEN_AUTH ||
    process.env.Msg91_TOKEN_AUTH ||
    process.env.MSG91_WIDGET_TOKEN ||
    "";
  if (authKey) process.env.MSG91_AUTH_KEY = authKey;
  else delete process.env.MSG91_AUTH_KEY;
  if (senderId) process.env.MSG91_SENDER_ID = senderId;
  else delete process.env.MSG91_SENDER_ID;
  if (templateId) process.env.MSG91_TEMPLATE_ID = templateId;
  else delete process.env.MSG91_TEMPLATE_ID;
  if (widgetId) process.env.MSG91_WIDGET_ID = widgetId;
  else delete process.env.MSG91_WIDGET_ID;
  if (tokenAuth) process.env.MSG91_TOKEN_AUTH = tokenAuth;
  else delete process.env.MSG91_TOKEN_AUTH;
}

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default("8h"),
    SETTINGS_ENCRYPTION_KEY: z.string().min(32).optional(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_PUBLIC_BASE_URL: z.string().url().optional(),
    WEB_ORIGIN: z.string().min(1).default("http://localhost:5173"),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    SMTP_FROM: z.string().email().default("noreply@saas-cms-lms.local"),
    SMTP_FROM_NAME: z.string().trim().min(1).max(80).default("SaaS CMS LMS"),
    MSG91_AUTH_KEY: z.string().min(1).optional(),
    MSG91_SENDER_ID: z.string().min(1).optional(),
    MSG91_TEMPLATE_ID: z.string().min(1).optional(),
    MSG91_WIDGET_ID: z.string().min(1).optional(),
    MSG91_TOKEN_AUTH: z.string().min(1).optional(),
    PUSH_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    PUSH_VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    PUSH_CONTACT_EMAIL: z.string().email().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).default("ap-south-1"),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    S3_PUBLIC_BASE_URL: z.string().url().optional(),
    RAZORPAY_KEY_ID: z.string().min(1).optional(),
    RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const anySmtp = Boolean(value.SMTP_HOST || value.SMTP_USER || value.SMTP_PASS);
    if (anySmtp) {
      if (!value.SMTP_HOST) {
        ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST is required when SMTP is enabled" });
      }
      if (!value.SMTP_USER) {
        ctx.addIssue({ code: "custom", path: ["SMTP_USER"], message: "SMTP_USER is required when SMTP is enabled" });
      }
      if (!value.SMTP_PASS) {
        ctx.addIssue({ code: "custom", path: ["SMTP_PASS"], message: "SMTP_PASS is required when SMTP is enabled" });
      }
    }

    // SMS sending needs auth key + sender. OTP widget can use auth key without sender.
    const anyMsg91Sms = Boolean(value.MSG91_SENDER_ID || value.MSG91_TEMPLATE_ID);
    if (anyMsg91Sms) {
      if (!value.MSG91_AUTH_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["MSG91_AUTH_KEY"],
          message: "MSG91_AUTH_KEY is required when MSG91 SMS is configured",
        });
      }
      if (!value.MSG91_SENDER_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["MSG91_SENDER_ID"],
          message: "MSG91_SENDER_ID is required when MSG91 SMS is configured",
        });
      }
    }

    const anyMsg91Otp = Boolean(value.MSG91_WIDGET_ID || value.MSG91_TOKEN_AUTH);
    if (anyMsg91Otp) {
      if (!value.MSG91_AUTH_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["MSG91_AUTH_KEY"],
          message: "MSG91_AUTH_KEY is required when MSG91 OTP widget is configured",
        });
      }
      if (!value.MSG91_WIDGET_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["MSG91_WIDGET_ID"],
          message: "MSG91_WIDGET_ID is required when MSG91 OTP widget is configured",
        });
      }
      if (!value.MSG91_TOKEN_AUTH) {
        ctx.addIssue({
          code: "custom",
          path: ["MSG91_TOKEN_AUTH"],
          message: "MSG91_TOKEN_AUTH is required when MSG91 OTP widget is configured",
        });
      }
    }

    const anyPush = Boolean(
      value.PUSH_VAPID_PUBLIC_KEY || value.PUSH_VAPID_PRIVATE_KEY || value.PUSH_CONTACT_EMAIL,
    );
    if (anyPush) {
      if (!value.PUSH_VAPID_PUBLIC_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["PUSH_VAPID_PUBLIC_KEY"],
          message: "PUSH_VAPID_PUBLIC_KEY is required when push is configured",
        });
      }
      if (!value.PUSH_VAPID_PRIVATE_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["PUSH_VAPID_PRIVATE_KEY"],
          message: "PUSH_VAPID_PRIVATE_KEY is required when push is configured",
        });
      }
      if (!value.PUSH_CONTACT_EMAIL) {
        ctx.addIssue({
          code: "custom",
          path: ["PUSH_CONTACT_EMAIL"],
          message: "PUSH_CONTACT_EMAIL is required when push is configured",
        });
      }
    }

    if (value.STORAGE_DRIVER === "s3") {
      if (!value.S3_BUCKET) {
        ctx.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "S3_BUCKET is required when STORAGE_DRIVER=s3" });
      }
      if (!value.S3_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_ACCESS_KEY_ID"],
          message: "S3_ACCESS_KEY_ID is required when STORAGE_DRIVER=s3",
        });
      }
      if (!value.S3_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_SECRET_ACCESS_KEY"],
          message: "S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=s3",
        });
      }
    }
  });

export const env = schema.parse({
  ...process.env,
  WEB_ORIGIN: process.env.WEB_ORIGIN?.replace(/\/+$/, "") || "http://localhost:5173",
});

export function isMsg91EnvConfigured() {
  return Boolean(env.MSG91_AUTH_KEY && env.MSG91_SENDER_ID);
}

export function isMsg91OtpWidgetConfigured() {
  return Boolean(env.MSG91_AUTH_KEY && env.MSG91_WIDGET_ID && env.MSG91_TOKEN_AUTH);
}

export function isPushEnvConfigured() {
  return Boolean(env.PUSH_VAPID_PUBLIC_KEY && env.PUSH_VAPID_PRIVATE_KEY && env.PUSH_CONTACT_EMAIL);
}

export function isFcmEnvConfigured() {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

export function loadFirebaseServiceAccountJson(): string | null {
  if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const filePath = path.isAbsolute(env.FIREBASE_SERVICE_ACCOUNT_PATH)
        ? env.FIREBASE_SERVICE_ACCOUNT_PATH
        : path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
      return readFileSync(filePath, "utf8");
    } catch (error) {
      const message = error instanceof Error ? error.message : "read failed";
      console.error(`[fcm] Failed to read FIREBASE_SERVICE_ACCOUNT_PATH: ${message}`);
      return null;
    }
  }
  return env.FIREBASE_SERVICE_ACCOUNT_JSON ?? null;
}
