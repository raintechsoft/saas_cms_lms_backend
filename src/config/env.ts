import "dotenv/config";
import { z } from "zod";

const schema = z.object({
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
}).superRefine((value, ctx) => {
  const anySmtp = Boolean(value.SMTP_HOST || value.SMTP_USER || value.SMTP_PASS);
  if (!anySmtp) return;
  if (!value.SMTP_HOST) {
    ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST is required when SMTP is enabled" });
  }
  if (!value.SMTP_USER) {
    ctx.addIssue({ code: "custom", path: ["SMTP_USER"], message: "SMTP_USER is required when SMTP is enabled" });
  }
  if (!value.SMTP_PASS) {
    ctx.addIssue({ code: "custom", path: ["SMTP_PASS"], message: "SMTP_PASS is required when SMTP is enabled" });
  }
});

export const env = schema.parse(process.env);
