import "dotenv/config";
import { z } from "zod";

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
