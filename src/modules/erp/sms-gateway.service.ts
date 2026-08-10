import type { Prisma, SmsTemplateType } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getTenantIntegration, updateIntegrationSetting } from "./erp.service.js";

const DEFAULT_TEMPLATES: Array<{
  name: string;
  type: SmsTemplateType;
  body: string;
  isDefault?: boolean;
  sortOrder: number;
}> = [
  {
    name: "Fee Reminder",
    type: "TRANSACTIONAL",
    body: "Dear {student_name}, fee of {amount} is due on {due_date}. Pay online to avoid late fee. - {school_name}",
    isDefault: true,
    sortOrder: 1,
  },
  {
    name: "Attendance Alert",
    type: "ALERT",
    body: "Dear Parent, {student_name} is marked {status} on {date}. - {school_name}",
    isDefault: true,
    sortOrder: 2,
  },
  {
    name: "Admission Confirmation",
    type: "TRANSACTIONAL",
    body: "Congratulations {student_name}! Your admission to {school_name} is confirmed. Admission No: {admission_no}",
    sortOrder: 3,
  },
  {
    name: "Exam Schedule",
    type: "ALERT",
    body: "Dear {student_name}, {exam_name} starts on {start_date}. Please check the timetable. - {school_name}",
    sortOrder: 4,
  },
  {
    name: "General Notice",
    type: "PROMOTIONAL",
    body: "Dear Parent/Student, {message}. - {school_name}",
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

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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

async function ensureTemplates(tenantId: string) {
  const count = await prisma.smsTemplate.count({ where: { tenantId } });
  if (count > 0) return;
  await prisma.smsTemplate.createMany({
    data: DEFAULT_TEMPLATES.map((item) => ({
      tenantId,
      name: item.name,
      type: item.type,
      body: item.body,
      isDefault: item.isDefault ?? false,
      isActive: true,
      sortOrder: item.sortOrder,
    })),
  });
}

export type SmsGatewayInput = {
  provider?: string | null;
  isEnabled: boolean;
  gatewayName?: string;
  senderId?: string;
  country?: string;
  route?: string;
  templateId?: string;
  balanceCredits?: number;
  authKey?: string;
  apiSecret?: string;
};

export async function getSmsGatewaySetup(tenantId: string) {
  await ensureTemplates(tenantId);

  const monthStart = startOfMonth();
  const [integration, templates, recent, todayCount, monthLogs] = await Promise.all([
    getTenantIntegration(tenantId, "SMS"),
    prisma.smsTemplate.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.smsDeliveryLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.smsDeliveryLog.count({
      where: { tenantId, status: "SUCCESS", createdAt: { gte: startOfDay() } },
    }),
    prisma.smsDeliveryLog.findMany({
      where: { tenantId, status: "SUCCESS", createdAt: { gte: monthStart } },
      select: { category: true },
    }),
  ]);

  const config = asObject(integration?.config);
  const provider = integration?.provider || "msg91";
  const gatewayName = str(config.gatewayName) || `${provider.toUpperCase()} Primary`;
  const balanceCredits = num(config.balanceCredits, 0);
  const monthCount = monthLogs.length;

  let promotional = 0;
  let transactional = 0;
  let others = 0;
  for (const log of monthLogs) {
    const cat = (log.category ?? "").toUpperCase();
    if (cat === "PROMOTIONAL") promotional += 1;
    else if (cat === "TRANSACTIONAL" || cat === "OTP" || cat === "ALERT") transactional += 1;
    else others += 1;
  }
  const usageTotal = promotional + transactional + others || 1;

  return {
    gateway: {
      provider,
      isEnabled: Boolean(integration?.isEnabled),
      hasSecrets: Boolean(integration?.encryptedSecrets || integration?.secrets),
      gatewayName,
      senderId: str(config.senderId),
      country: str(config.country, "91") || "91",
      route: str(config.route, "4") || "4",
      templateId: str(config.templateId),
      balanceCredits,
      lastTestStatus: str(config.lastTestStatus) || null,
      lastTestedAt: str(config.lastTestedAt) || null,
      updatedAt: integration?.updatedAt?.toISOString() ?? null,
    },
    providers: [
      { key: "msg91", label: "MSG91" },
      { key: "twilio", label: "Twilio" },
      { key: "textlocal", label: "Textlocal" },
    ],
    templates: templates.map((item, index) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      body: item.body,
      providerCode: item.providerCode,
      isDefault: item.isDefault,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
      updatedAtLabel: formatUpdatedAt(item.updatedAt),
      index: index + 1,
    })),
    recentActivity: recent.map((item) => ({
      id: item.id,
      toNumber: item.toNumber,
      bodyPreview: item.bodyPreview,
      status: item.status,
      provider: item.provider,
      category: item.category,
      errorMessage: item.errorMessage,
      createdAtLabel: formatUpdatedAt(item.createdAt),
    })),
    usage: {
      promotional,
      transactional,
      others,
      breakdown: [
        {
          key: "promotional",
          label: "Promotional",
          count: promotional,
          percent: Math.round((promotional / usageTotal) * 1000) / 10,
        },
        {
          key: "transactional",
          label: "Transactional",
          count: transactional,
          percent: Math.round((transactional / usageTotal) * 1000) / 10,
        },
        {
          key: "others",
          label: "Others",
          count: others,
          percent: Math.round((others / usageTotal) * 1000) / 10,
        },
      ],
    },
    stats: {
      activeGateway: integration?.isEnabled ? gatewayName : "Not configured",
      isActive: Boolean(integration?.isEnabled),
      todaySent: todayCount,
      monthlyUsage: monthCount,
      smsBalance: balanceCredits,
      templateCount: templates.length,
    },
  };
}

export async function saveSmsGateway(tenantId: string, input: SmsGatewayInput) {
  const existing = await getTenantIntegration(tenantId, "SMS");
  const currentConfig = asObject(existing?.config);

  const config = {
    ...currentConfig,
    gatewayName: input.gatewayName?.trim() || str(currentConfig.gatewayName) || "Primary Gateway",
    senderId: (input.senderId ?? str(currentConfig.senderId)).toUpperCase(),
    country: input.country?.trim() || str(currentConfig.country, "91") || "91",
    route: input.route?.trim() || str(currentConfig.route, "4") || "4",
    templateId: input.templateId?.trim() ?? str(currentConfig.templateId),
    balanceCredits:
      input.balanceCredits !== undefined
        ? input.balanceCredits
        : num(currentConfig.balanceCredits, 0),
  };

  const secrets: Record<string, string> = {};
  if (input.authKey?.trim()) secrets.authKey = input.authKey.trim();
  if (input.apiSecret?.trim()) secrets.apiSecret = input.apiSecret.trim();

  if (input.isEnabled) {
    const senderOk = config.senderId.length >= 3;
    const hasKey = Boolean(secrets.authKey) || Boolean(existing?.encryptedSecrets);
    if (!senderOk || !hasKey) {
      throw new AppError(
        400,
        "Sender ID and Auth Key are required to activate the gateway",
        "SMS_GATEWAY_INCOMPLETE",
      );
    }
  }

  await updateIntegrationSetting(tenantId, "SMS", {
    provider: input.provider?.trim().toLowerCase() || existing?.provider || "msg91",
    isEnabled: input.isEnabled,
    config: config as Prisma.InputJsonValue,
    ...(Object.keys(secrets).length ? { secrets } : {}),
  });

  return getSmsGatewaySetup(tenantId);
}

export async function testSmsGateway(tenantId: string) {
  const integration = await getTenantIntegration(tenantId, "SMS");
  if (!integration?.isEnabled) {
    throw new AppError(400, "Enable and save the gateway before testing", "SMS_GATEWAY_DISABLED");
  }
  const config = asObject(integration.config);
  const secrets = integration.secrets ?? {};
  const authKey = str(secrets.authKey ?? secrets.authkey ?? secrets.apiKey);
  const senderId = str(config.senderId).toUpperCase();
  if (authKey.length < 16 || senderId.length < 3) {
    throw new AppError(400, "MSG91 credentials look incomplete", "SMS_GATEWAY_INVALID");
  }

  // Lightweight credential check against MSG91 balance endpoint
  let ok = false;
  let detail = "";
  try {
    const response = await fetch(
      `https://control.msg91.com/api/balance.php?authkey=${encodeURIComponent(authKey)}&type=4`,
    );
    const text = await response.text();
    detail = text.trim();
    ok = response.ok && !/invalid|error|disabled/i.test(detail);
    const balance = Number(detail);
    if (Number.isFinite(balance)) {
      await updateIntegrationSetting(tenantId, "SMS", {
        provider: integration.provider,
        isEnabled: integration.isEnabled,
        config: {
          ...config,
          balanceCredits: balance,
          lastTestStatus: ok ? "SUCCESS" : "FAILED",
          lastTestedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      });
    } else {
      await updateIntegrationSetting(tenantId, "SMS", {
        provider: integration.provider,
        isEnabled: integration.isEnabled,
        config: {
          ...config,
          lastTestStatus: ok ? "SUCCESS" : "FAILED",
          lastTestedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      });
    }
  } catch (cause) {
    detail = cause instanceof Error ? cause.message : "Connection failed";
    ok = false;
    await updateIntegrationSetting(tenantId, "SMS", {
      provider: integration.provider,
      isEnabled: integration.isEnabled,
      config: {
        ...config,
        lastTestStatus: "FAILED",
        lastTestedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    });
  }

  if (!ok) {
    throw new AppError(502, `SMS gateway test failed: ${detail || "unknown error"}`, "SMS_TEST_FAILED");
  }

  return getSmsGatewaySetup(tenantId);
}

export type SmsTemplateInput = {
  name: string;
  type?: SmsTemplateType;
  body: string;
  providerCode?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

export async function upsertSmsTemplate(
  tenantId: string,
  input: SmsTemplateInput & { id?: string },
) {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || !body) {
    throw new AppError(400, "Template name and body are required", "SMS_TEMPLATE_INVALID");
  }

  if (input.isDefault) {
    await prisma.smsTemplate.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  if (input.id) {
    const found = await prisma.smsTemplate.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Template not found", "SMS_TEMPLATE_NOT_FOUND");
    await prisma.smsTemplate.update({
      where: { id: input.id },
      data: {
        name,
        body,
        type: input.type ?? found.type,
        providerCode: input.providerCode?.trim() || null,
        isDefault: input.isDefault ?? found.isDefault,
        isActive: input.isActive ?? found.isActive,
      },
    });
  } else {
    const exists = await prisma.smsTemplate.findFirst({
      where: tenantScope(tenantId, { name }),
    });
    if (exists) throw new AppError(409, "Template name already exists", "SMS_TEMPLATE_EXISTS");
    const maxSort = await prisma.smsTemplate.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    await prisma.smsTemplate.create({
      data: {
        tenantId,
        name,
        body,
        type: input.type ?? "GENERAL",
        providerCode: input.providerCode?.trim() || null,
        isDefault: input.isDefault ?? false,
        isActive: input.isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  return getSmsGatewaySetup(tenantId);
}

export async function cloneSmsTemplate(tenantId: string, id: string) {
  const found = await prisma.smsTemplate.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Template not found", "SMS_TEMPLATE_NOT_FOUND");

  let name = `${found.name} Copy`;
  let suffix = 2;
  while (await prisma.smsTemplate.findFirst({ where: tenantScope(tenantId, { name }) })) {
    name = `${found.name} Copy ${suffix}`;
    suffix += 1;
  }

  const maxSort = await prisma.smsTemplate.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });

  await prisma.smsTemplate.create({
    data: {
      tenantId,
      name,
      type: found.type,
      body: found.body,
      providerCode: found.providerCode,
      isDefault: false,
      isActive: found.isActive,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return getSmsGatewaySetup(tenantId);
}

export async function deleteSmsTemplate(tenantId: string, id: string) {
  const found = await prisma.smsTemplate.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Template not found", "SMS_TEMPLATE_NOT_FOUND");
  await prisma.smsTemplate.delete({ where: { id } });
  return getSmsGatewaySetup(tenantId);
}

export async function logSmsDelivery(input: {
  tenantId: string;
  toNumber: string;
  body: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  provider?: string | null;
  category?: string | null;
  errorMessage?: string | null;
}) {
  await prisma.smsDeliveryLog.create({
    data: {
      tenantId: input.tenantId,
      toNumber: input.toNumber,
      bodyPreview: input.body.slice(0, 160),
      status: input.status,
      provider: input.provider ?? null,
      category: input.category ?? null,
      errorMessage: input.errorMessage ?? null,
    },
  });
}
