import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter =
  env.SMTP_HOST && env.SMTP_USER
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      })
    : null;

export function isMailConfigured() {
  return Boolean(transporter);
}

export async function sendMail(input: { to: string; subject: string; text: string; html?: string }) {
  if (!transporter) {
    console.info("[mail] SMTP not configured — delivery skipped");
    console.info(`[mail] To: ${input.to}`);
    console.info(`[mail] Subject: ${input.subject}`);
    console.info(`[mail] Body:\n${input.text}`);
    return { delivered: false as const };
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text.replace(/\n/g, "<br>"),
  });
  return { delivered: true as const };
}
