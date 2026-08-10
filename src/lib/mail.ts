import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";
import { getTenantIntegration } from "../modules/erp/erp.service.js";
import { logEmailDelivery } from "../modules/erp/email-gateway.service.js";

function createEnvTransporter(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

const envTransporter = createEnvTransporter();

function mailFromAddress(from?: string, fromName?: string) {
  const address = from || env.SMTP_FROM || env.SMTP_USER || "noreply@saas-cms-lms.local";
  const name = (fromName ?? env.SMTP_FROM_NAME).trim();
  return name ? { name, address } : address;
}

export function isMailConfigured() {
  return Boolean(envTransporter);
}

/** Checks SMTP credentials; useful at startup or via `npm run mail:verify`. */
export async function verifyMailConnection() {
  if (!envTransporter) {
    return { ok: false as const, reason: "SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)" };
  }

  try {
    await envTransporter.verify();
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP verify failed";
    return { ok: false as const, reason: message };
  }
}

async function resolveTransporter(tenantId?: string): Promise<{
  transporter: Transporter | null;
  from?: string;
  fromName?: string;
}> {
  if (tenantId) {
    const integration = await getTenantIntegration(tenantId, "EMAIL");
    if (integration?.isEnabled) {
      const config = (integration.config ?? {}) as Record<string, unknown>;
      const secrets = integration.secrets ?? {};
      const host = String(config.host ?? config.smtpHost ?? "").trim();
      const user = String(secrets.user ?? secrets.username ?? config.user ?? "").trim();
      const pass = String(secrets.pass ?? secrets.password ?? "").trim();
      if (host && user && pass) {
        const port = Number(config.port ?? config.smtpPort ?? 587);
        const secure = Boolean(config.secure ?? port === 465);
        return {
          transporter: nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass },
          }),
          from: String(config.from ?? config.fromEmail ?? user),
          fromName: String(config.fromName ?? ""),
        };
      }
    }
  }
  return { transporter: envTransporter };
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  tenantId?: string;
  category?: string;
}) {
  const resolved = await resolveTransporter(input.tenantId);
  if (!resolved.transporter) {
    if (input.tenantId) {
      await logEmailDelivery({
        tenantId: input.tenantId,
        toEmail: input.to,
        subject: input.subject,
        body: input.text,
        status: "SKIPPED",
        category: input.category ?? "SYSTEM",
        errorMessage: "Email not configured",
      }).catch(() => undefined);
    }
    if (env.NODE_ENV === "production") {
      throw new AppError(503, "Email delivery is not configured", "MAIL_NOT_CONFIGURED");
    }
    console.info("[mail] SMTP not configured — delivery skipped (dev fallback)");
    console.info(`[mail] To: ${input.to}`);
    console.info(`[mail] Subject: ${input.subject}`);
    console.info(`[mail] Body:\n${input.text}`);
    return { delivered: false as const };
  }

  try {
    const from = mailFromAddress(resolved.from, resolved.fromName);
    const info = await resolved.transporter.sendMail({
      from,
      replyTo: typeof from === "string" ? from : from.address,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, "<br>"),
      headers: {
        "X-Entity-Ref-ID": `saas-cms-lms-${Date.now()}`,
      },
    });
    if (input.tenantId) {
      await logEmailDelivery({
        tenantId: input.tenantId,
        toEmail: input.to,
        subject: input.subject,
        body: input.text,
        status: "SUCCESS",
        gatewayName: resolved.fromName || "SMTP",
        category: input.category ?? "TRANSACTIONAL",
      }).catch(() => undefined);
    }
    console.info(`[mail] Delivered to ${input.to} messageId=${info.messageId}`);
    return { delivered: true as const, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    if (input.tenantId) {
      await logEmailDelivery({
        tenantId: input.tenantId,
        toEmail: input.to,
        subject: input.subject,
        body: input.text,
        status: "FAILED",
        category: input.category ?? "TRANSACTIONAL",
        errorMessage: message,
      }).catch(() => undefined);
    }
    console.error(`[mail] Send failed: ${message}`);
    throw new AppError(502, "Failed to send email", "MAIL_SEND_FAILED");
  }
}

export function otpEmailHtml(input: { firstName: string; code: string; workspaceName?: string }) {
  const workspace = input.workspaceName?.trim() || "your workspace";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px 24px;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
          <tr><td style="font-size:13px;color:#0f766e;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">SaaS CMS LMS</td></tr>
          <tr><td style="padding-top:12px;font-size:22px;font-weight:700;">Your sign-in code</td></tr>
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#334155;">Hello ${escapeHtml(input.firstName)},</td></tr>
          <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#334155;">Use this one-time code to sign in to <strong>${escapeHtml(workspace)}</strong>:</td></tr>
          <tr><td style="padding-top:20px;font-size:32px;letter-spacing:8px;font-weight:700;color:#0f172a;">${escapeHtml(input.code)}</td></tr>
          <tr><td style="padding-top:20px;font-size:13px;line-height:1.5;color:#64748b;">This code expires in 10 minutes. If you did not request it, you can ignore this email.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function resetPasswordEmailHtml(input: {
  firstName: string;
  resetUrl: string;
  workspaceName?: string;
}) {
  const workspace = input.workspaceName?.trim() || "your workspace";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px 24px;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
          <tr><td style="font-size:13px;color:#0f766e;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">SaaS CMS LMS</td></tr>
          <tr><td style="padding-top:12px;font-size:22px;font-weight:700;">Reset your password</td></tr>
          <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#334155;">Hello ${escapeHtml(input.firstName)},</td></tr>
          <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#334155;">We received a request to reset your password for <strong>${escapeHtml(workspace)}</strong>.</td></tr>
          <tr>
            <td style="padding-top:20px;">
              <a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                Choose a new password
              </a>
            </td>
          </tr>
          <tr><td style="padding-top:16px;font-size:12px;line-height:1.5;color:#64748b;">Or open this link:</td></tr>
          <tr><td style="font-size:12px;line-height:1.5;color:#334155;word-break:break-all;">${escapeHtml(input.resetUrl)}</td></tr>
          <tr><td style="padding-top:16px;font-size:13px;line-height:1.5;color:#64748b;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
