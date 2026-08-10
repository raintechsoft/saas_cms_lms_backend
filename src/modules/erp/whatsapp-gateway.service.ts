import { randomBytes } from "node:crypto";
import type { Prisma, WhatsAppTemplateStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getTenantIntegration, updateIntegrationSetting } from "./erp.service.js";

const DEFAULT_EVENTS = [
  "messages",
  "delivery_updates",
  "message_status",
  "read_receipts",
  "template_status",
] as const;

const DEFAULT_TEMPLATES = [
  {
    name: "fee_payment_receipt",
    language: "en",
    category: "UTILITY",
    body: "Dear Parent, fee payment of {amount} for {student_name} has been received by {school_name}. Receipt No: {receipt_no}. Thank you.",
    status: "APPROVED" as WhatsAppTemplateStatus,
    sortOrder: 1,
  },
  {
    name: "attendance_alert",
    language: "en",
    category: "UTILITY",
    body: "Dear Parent, {student_name} is marked {status} on {date}. - {school_name}",
    status: "APPROVED" as WhatsAppTemplateStatus,
    sortOrder: 2,
  },
  {
    name: "exam_reminder",
    language: "en",
    category: "UTILITY",
    body: "Reminder: {exam_name} for {student_name} starts on {start_date}. - {school_name}",
    status: "PENDING" as WhatsAppTemplateStatus,
    sortOrder: 3,
  },
  {
    name: "holiday_notice",
    language: "en",
    category: "MARKETING",
    body: "Dear Parent/Student, {school_name} will remain closed on {date} for {reason}.",
    status: "REJECTED" as WhatsAppTemplateStatus,
    sortOrder: 4,
  },
  {
    name: "old_welcome",
    language: "en",
    category: "UTILITY",
    body: "Welcome to {school_name}!",
    status: "ARCHIVED" as WhatsAppTemplateStatus,
    sortOrder: 5,
  },
];

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function num(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatUpdatedAt(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function publicBaseUrl() {
  const configured = str((env as { APP_URL?: string }).APP_URL || process.env.APP_URL || process.env.API_PUBLIC_URL);
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:4000/api/v1";
}

async function ensureDefaults(tenantId: string) {
  const [templateCount, integration] = await Promise.all([
    prisma.whatsAppTemplate.count({ where: { tenantId } }),
    getTenantIntegration(tenantId, "WHATSAPP"),
  ]);

  if (!integration) {
    await updateIntegrationSetting(tenantId, "WHATSAPP", {
      provider: "meta",
      isEnabled: false,
      config: {
        wabaId: "",
        phoneNumberId: "",
        phoneNumber: "",
        verifyToken: randomBytes(16).toString("hex"),
        webhookEvents: [...DEFAULT_EVENTS],
        businessHoursMode: "always",
        defaultLanguage: "en",
        fallbackLanguage: "en",
        templateCategoryFilter: "ALL",
        messageQuotaLimit: 100000,
        messageQuotaUsed: 0,
        quotaResetAt: null,
        lastConnectedAt: null,
        lastTestStatus: null,
        tokenExpiresAt: null,
        phoneVerified: false,
      },
    });
  } else {
    const config = asObject(integration.config);
    if (!str(config.verifyToken)) {
      await updateIntegrationSetting(tenantId, "WHATSAPP", {
        provider: integration.provider ?? "meta",
        isEnabled: integration.isEnabled,
        config: {
          ...config,
          verifyToken: randomBytes(16).toString("hex"),
        } as Prisma.InputJsonValue,
      });
    }
  }

  if (templateCount === 0) {
    await prisma.whatsAppTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((item) => ({
        tenantId,
        name: item.name,
        language: item.language,
        category: item.category,
        body: item.body,
        status: item.status,
        isActive: item.status === "APPROVED",
        sortOrder: item.sortOrder,
      })),
    });
  }
}

export async function getWhatsAppGatewaySetup(tenantId: string) {
  await ensureDefaults(tenantId);

  const [integration, templates, monthLogs] = await Promise.all([
    getTenantIntegration(tenantId, "WHATSAPP"),
    prisma.whatsAppTemplate.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.whatsAppDeliveryLog.findMany({
      where: { tenantId, createdAt: { gte: startOfMonth() } },
      select: { status: true, chargePaise: true },
    }),
  ]);

  const config = asObject(integration?.config);
  const secrets = integration?.secrets ?? {};
  const hasToken = Boolean(str(secrets.accessToken ?? secrets.token));
  const isConnected = Boolean(integration?.isEnabled && hasToken && str(config.phoneNumberId));

  const sent = monthLogs.length;
  const delivered = monthLogs.filter((l) =>
    ["DELIVERED", "READ", "SENT"].includes(l.status),
  ).length;
  const read = monthLogs.filter((l) => l.status === "READ").length;
  const failed = monthLogs.filter((l) => l.status === "FAILED").length;
  const chargesPaise = monthLogs.reduce((sum, l) => sum + (l.chargePaise ?? 0), 0);

  const approved = templates.filter((t) => t.status === "APPROVED").length;
  const pending = templates.filter((t) => t.status === "PENDING").length;
  const rejected = templates.filter((t) => t.status === "REJECTED").length;
  const archived = templates.filter((t) => t.status === "ARCHIVED").length;

  const quotaLimit = num(config.messageQuotaLimit, 100000);
  const quotaUsed = num(config.messageQuotaUsed, sent);

  return {
    connection: {
      provider: integration?.provider || "meta",
      isEnabled: Boolean(integration?.isEnabled),
      isConnected,
      hasAccessToken: hasToken,
      wabaId: str(config.wabaId),
      phoneNumberId: str(config.phoneNumberId),
      phoneNumber: str(config.phoneNumber),
      phoneVerified: bool(config.phoneVerified, Boolean(str(config.phoneNumber))),
      verifyToken: str(config.verifyToken),
      webhookUrl: `${publicBaseUrl()}/public/whatsapp/webhook`,
      webhookEvents: asStringArray(config.webhookEvents, [...DEFAULT_EVENTS]),
      businessHoursMode: str(config.businessHoursMode, "always") || "always",
      defaultLanguage: str(config.defaultLanguage, "en") || "en",
      fallbackLanguage: str(config.fallbackLanguage, "en") || "en",
      templateCategoryFilter: str(config.templateCategoryFilter, "ALL") || "ALL",
      lastConnectedAt: str(config.lastConnectedAt) || null,
      lastConnectedAtLabel: config.lastConnectedAt
        ? formatUpdatedAt(new Date(String(config.lastConnectedAt)))
        : null,
      lastTestStatus: str(config.lastTestStatus) || null,
      tokenExpiresAt: str(config.tokenExpiresAt) || null,
      messageQuotaLimit: quotaLimit,
      messageQuotaUsed: quotaUsed,
      quotaResetAt: str(config.quotaResetAt) || null,
      previewSchoolName: str(config.previewSchoolName) || "Sunshine Public School",
      previewMessage:
        str(config.previewMessage) ||
        "Dear Parent, fee payment of ₹5,000 for Rahul Sharma has been received. Receipt No: RCP-2045. Thank you. - Sunshine Public School",
    },
    eventOptions: [
      { key: "messages", label: "Messages" },
      { key: "delivery_updates", label: "Delivery Updates" },
      { key: "message_status", label: "Message Status Updates" },
      { key: "read_receipts", label: "Read Receipts" },
      { key: "template_status", label: "Template Status Updates" },
      { key: "account_updates", label: "Account Updates" },
    ],
    templates: templates.map((item) => ({
      id: item.id,
      name: item.name,
      language: item.language,
      category: item.category,
      body: item.body,
      status: item.status,
      providerCode: item.providerCode,
      isActive: item.isActive,
      updatedAtLabel: formatUpdatedAt(item.updatedAt),
    })),
    templateStats: { approved, pending, rejected, archived, active: approved },
    summary: {
      totalSent: sent,
      delivered,
      deliveredPercent: sent ? Math.round((delivered / sent) * 10000) / 100 : 0,
      read,
      readPercent: sent ? Math.round((read / sent) * 10000) / 100 : 0,
      failed,
      failedPercent: sent ? Math.round((failed / sent) * 10000) / 100 : 0,
      chargesPaise,
      chargesLabel: `₹ ${(chargesPaise / 100).toFixed(2)}`,
      growthPercent: 18.5,
    },
    stats: {
      connectionStatus: isConnected ? "Connected" : "Disconnected",
      phoneNumber: str(config.phoneNumber) || "Not set",
      phoneVerified: bool(config.phoneVerified, Boolean(str(config.phoneNumber))),
      quotaLabel: `${quotaUsed.toLocaleString("en-IN")} / ${quotaLimit.toLocaleString("en-IN")}`,
      quotaPercent: Math.min(100, Math.round((quotaUsed / Math.max(quotaLimit, 1)) * 1000) / 10),
      templatesApproved: approved,
      messagesSentMonth: sent,
      deliveredMonth: delivered,
      failedMonth: failed,
      lastConnectedAtLabel: config.lastConnectedAt
        ? formatUpdatedAt(new Date(String(config.lastConnectedAt)))
        : "—",
    },
  };
}

export type WhatsAppGatewayInput = {
  provider?: string | null;
  isEnabled?: boolean;
  wabaId?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  accessToken?: string;
  verifyToken?: string;
  webhookEvents?: string[];
  businessHoursMode?: "always" | "custom";
  defaultLanguage?: string;
  fallbackLanguage?: string;
  templateCategoryFilter?: string;
  messageQuotaLimit?: number;
  messageQuotaUsed?: number;
  previewSchoolName?: string;
  previewMessage?: string;
};

export async function saveWhatsAppGateway(tenantId: string, input: WhatsAppGatewayInput) {
  const existing = await getTenantIntegration(tenantId, "WHATSAPP");
  const current = asObject(existing?.config);
  const secrets: Record<string, string> = {};
  if (input.accessToken?.trim()) secrets.accessToken = input.accessToken.trim();

  const config = {
    ...current,
    wabaId: input.wabaId?.trim() ?? str(current.wabaId),
    phoneNumberId: input.phoneNumberId?.trim() ?? str(current.phoneNumberId),
    phoneNumber: input.phoneNumber?.trim() ?? str(current.phoneNumber),
    verifyToken: input.verifyToken?.trim() || str(current.verifyToken) || randomBytes(16).toString("hex"),
    webhookEvents: input.webhookEvents ?? asStringArray(current.webhookEvents, [...DEFAULT_EVENTS]),
    businessHoursMode:
      input.businessHoursMode ?? (str(current.businessHoursMode, "always") || "always"),
    defaultLanguage: input.defaultLanguage?.trim() || str(current.defaultLanguage, "en") || "en",
    fallbackLanguage: input.fallbackLanguage?.trim() || str(current.fallbackLanguage, "en") || "en",
    templateCategoryFilter:
      input.templateCategoryFilter?.trim() || str(current.templateCategoryFilter, "ALL") || "ALL",
    messageQuotaLimit:
      input.messageQuotaLimit !== undefined
        ? input.messageQuotaLimit
        : num(current.messageQuotaLimit, 100000),
    messageQuotaUsed:
      input.messageQuotaUsed !== undefined
        ? input.messageQuotaUsed
        : num(current.messageQuotaUsed, 0),
    previewSchoolName:
      input.previewSchoolName?.trim() || str(current.previewSchoolName) || "Sunshine Public School",
    previewMessage: input.previewMessage?.trim() || str(current.previewMessage),
    phoneVerified: bool(current.phoneVerified, Boolean(str(input.phoneNumber ?? current.phoneNumber))),
  };

  const enabled = input.isEnabled ?? existing?.isEnabled ?? false;

  await updateIntegrationSetting(tenantId, "WHATSAPP", {
    provider: input.provider?.trim().toLowerCase() || existing?.provider || "meta",
    isEnabled: enabled,
    config: config as Prisma.InputJsonValue,
    ...(Object.keys(secrets).length ? { secrets } : {}),
  });

  return getWhatsAppGatewaySetup(tenantId);
}

export async function testWhatsAppConnection(tenantId: string) {
  const integration = await getTenantIntegration(tenantId, "WHATSAPP");
  if (!integration) {
    throw new AppError(400, "Save WhatsApp settings before testing", "WHATSAPP_NOT_CONFIGURED");
  }
  const config = asObject(integration.config);
  const token = str(integration.secrets?.accessToken ?? integration.secrets?.token);
  const phoneNumberId = str(config.phoneNumberId);
  if (!token || !phoneNumberId) {
    throw new AppError(400, "Access token and Phone Number ID are required", "WHATSAPP_INCOMPLETE");
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const err =
        asObject(payload.error).message ||
        str(payload.error) ||
        `HTTP ${response.status}`;
      await updateIntegrationSetting(tenantId, "WHATSAPP", {
        provider: integration.provider,
        isEnabled: integration.isEnabled,
        config: {
          ...config,
          lastTestStatus: "FAILED",
        } as Prisma.InputJsonValue,
      });
      throw new AppError(502, `WhatsApp test failed: ${err}`, "WHATSAPP_TEST_FAILED");
    }

    await updateIntegrationSetting(tenantId, "WHATSAPP", {
      provider: integration.provider,
      isEnabled: true,
      config: {
        ...config,
        phoneNumber: str(payload.display_phone_number) || str(config.phoneNumber),
        phoneVerified: true,
        lastTestStatus: "SUCCESS",
        lastConnectedAt: new Date().toISOString(),
        tokenExpiresAt: str(config.tokenExpiresAt) || null,
      } as Prisma.InputJsonValue,
    });
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    const message = cause instanceof Error ? cause.message : "Connection failed";
    throw new AppError(502, `WhatsApp test failed: ${message}`, "WHATSAPP_TEST_FAILED");
  }

  return getWhatsAppGatewaySetup(tenantId);
}

export async function verifyWhatsAppWebhook(input: {
  mode?: string;
  verifyToken?: string;
  challenge?: string;
}) {
  if (input.mode !== "subscribe" || !input.verifyToken || !input.challenge) {
    throw new AppError(400, "Invalid webhook verification request", "WHATSAPP_WEBHOOK_INVALID");
  }

  const rows = await prisma.erpIntegrationSetting.findMany({
    where: { category: "WHATSAPP", isEnabled: true },
    select: { config: true },
    take: 50,
  });

  const matched = rows.some((row) => {
    const config = asObject(row.config);
    return str(config.verifyToken) === input.verifyToken;
  });

  if (!matched) {
    // Also allow matching any tenant verify token (even if not enabled yet)
    const any = await prisma.erpIntegrationSetting.findMany({
      where: { category: "WHATSAPP" },
      select: { config: true },
      take: 100,
    });
    const ok = any.some((row) => str(asObject(row.config).verifyToken) === input.verifyToken);
    if (!ok) throw new AppError(403, "Verify token mismatch", "WHATSAPP_WEBHOOK_FORBIDDEN");
  }

  return input.challenge;
}

export async function sendWhatsAppTestMessage(
  tenantId: string,
  input: { to: string; message?: string },
) {
  const to = input.to.trim();
  if (!to) throw new AppError(400, "Recipient number is required", "WHATSAPP_TO_REQUIRED");

  const setup = await getWhatsAppGatewaySetup(tenantId);
  const body = input.message?.trim() || setup.connection.previewMessage;
  const integration = await getTenantIntegration(tenantId, "WHATSAPP");
  const token = str(integration?.secrets?.accessToken);
  const phoneNumberId = setup.connection.phoneNumberId;

  if (!setup.connection.isConnected || !token || !phoneNumberId) {
    await prisma.whatsAppDeliveryLog.create({
      data: {
        tenantId,
        toNumber: to,
        bodyPreview: body.slice(0, 160),
        status: "SKIPPED",
        category: "TEST",
        errorMessage: "WhatsApp not connected",
      },
    });
    throw new AppError(400, "Connect WhatsApp before sending a test message", "WHATSAPP_NOT_CONNECTED");
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ""),
          type: "text",
          text: { body },
        }),
      },
    );
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const err = asObject(payload.error).message || `HTTP ${response.status}`;
      await prisma.whatsAppDeliveryLog.create({
        data: {
          tenantId,
          toNumber: to,
          bodyPreview: body.slice(0, 160),
          status: "FAILED",
          category: "TEST",
          errorMessage: String(err).slice(0, 500),
          chargePaise: 0,
        },
      });
      throw new AppError(502, `Failed to send WhatsApp message: ${err}`, "WHATSAPP_SEND_FAILED");
    }

    await prisma.whatsAppDeliveryLog.create({
      data: {
        tenantId,
        toNumber: to,
        bodyPreview: body.slice(0, 160),
        status: "SENT",
        category: "TEST",
        chargePaise: 65,
      },
    });
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError(502, "Failed to send WhatsApp message", "WHATSAPP_SEND_FAILED");
  }

  return getWhatsAppGatewaySetup(tenantId);
}

export async function upsertWhatsAppTemplate(
  tenantId: string,
  input: {
    id?: string;
    name: string;
    language?: string;
    category?: string;
    body: string;
    status?: WhatsAppTemplateStatus;
    isActive?: boolean;
  },
) {
  const name = input.name.trim().toLowerCase().replace(/\s+/g, "_");
  const body = input.body.trim();
  if (!name || !body) {
    throw new AppError(400, "Template name and body are required", "WHATSAPP_TEMPLATE_INVALID");
  }

  if (input.id) {
    const found = await prisma.whatsAppTemplate.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Template not found", "WHATSAPP_TEMPLATE_NOT_FOUND");
    await prisma.whatsAppTemplate.update({
      where: { id: input.id },
      data: {
        name,
        body,
        language: input.language?.trim() || found.language,
        category: input.category?.trim() || found.category,
        status: input.status ?? found.status,
        isActive: input.isActive ?? found.isActive,
      },
    });
  } else {
    const maxSort = await prisma.whatsAppTemplate.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    await prisma.whatsAppTemplate.create({
      data: {
        tenantId,
        name,
        body,
        language: input.language?.trim() || "en",
        category: input.category?.trim() || "UTILITY",
        status: input.status ?? "PENDING",
        isActive: input.isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  return getWhatsAppGatewaySetup(tenantId);
}

export async function deleteWhatsAppTemplate(tenantId: string, id: string) {
  const found = await prisma.whatsAppTemplate.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Template not found", "WHATSAPP_TEMPLATE_NOT_FOUND");
  await prisma.whatsAppTemplate.delete({ where: { id } });
  return getWhatsAppGatewaySetup(tenantId);
}
