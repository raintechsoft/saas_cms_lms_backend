import "dotenv/config";
import { z } from "zod";

// Accept common Twilio env aliases (Windows/.env casing variants).
{
  const sid =
    process.env.TWILIO_ACCOUNT_SID ||
    process.env.Twilio_ACCOUNT_SID ||
    process.env.TWILIO_SID ||
    "";
  const token =
    process.env.TWILIO_AUTH_TOKEN ||
    process.env.Twilio_AUTH_TOKEN ||
    process.env.TWILIO_TOKEN ||
    "";
  const from =
    process.env.TWILIO_FROM_NUMBER ||
    process.env.Twilio_PHONE_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    process.env.Twilio_FROM_NUMBER ||
    "";
  if (sid) process.env.TWILIO_ACCOUNT_SID = sid;
  else delete process.env.TWILIO_ACCOUNT_SID;
  if (token) process.env.TWILIO_AUTH_TOKEN = token;
  else delete process.env.TWILIO_AUTH_TOKEN;
  if (from) process.env.TWILIO_FROM_NUMBER = from;
  else delete process.env.TWILIO_FROM_NUMBER;
}

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default("8h"),
    SETTINGS_ENCRYPTION_KEY: z.string().min(32).optional(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
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
    TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    TWILIO_FROM_NUMBER: z.string().min(1).optional(),
    PUSH_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    PUSH_VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    PUSH_CONTACT_EMAIL: z.string().email().optional(),
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

    const anyTwilio = Boolean(
      value.TWILIO_ACCOUNT_SID || value.TWILIO_AUTH_TOKEN || value.TWILIO_FROM_NUMBER,
    );
    if (anyTwilio) {
      if (!value.TWILIO_ACCOUNT_SID) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_ACCOUNT_SID"],
          message: "TWILIO_ACCOUNT_SID is required when Twilio SMS is configured",
        });
      }
      if (!value.TWILIO_AUTH_TOKEN) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_AUTH_TOKEN"],
          message: "TWILIO_AUTH_TOKEN is required when Twilio SMS is configured",
        });
      }
      if (!value.TWILIO_FROM_NUMBER) {
        ctx.addIssue({
          code: "custom",
          path: ["TWILIO_FROM_NUMBER"],
          message: "TWILIO_FROM_NUMBER (or Twilio_PHONE_NUMBER) is required when Twilio SMS is configured",
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

export const env = schema.parse(process.env);

export function isTwilioEnvConfigured() {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
}

export function isPushEnvConfigured() {
  return Boolean(env.PUSH_VAPID_PUBLIC_KEY && env.PUSH_VAPID_PRIVATE_KEY && env.PUSH_CONTACT_EMAIL);
}
