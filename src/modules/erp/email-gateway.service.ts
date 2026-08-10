import type { EmailEncryption, EmailTemplateType, Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import {
  decryptSecrets,
  encryptSecrets,
  getTenantIntegration,
  updateIntegrationSetting,
} from "./erp.service.js";

const DEFAULT_TEMPLATES: Array<{
  name: string;
  type: EmailTemplateType;
  subject: string;
  body: string;
  isDefault?: boolean;
  sortOrder: number;
}> = [
  {
    name: "Fee Reminder",
    type: "TRANSACTIONAL",
    subject: "Fee reminder for {student_name}",
    body: "Dear Parent,\n\nFee of {amount} for {student_name} is due on {due_date}.\n\nRegards,\n{school_name}",
    isDefault: true,
    sortOrder: 1,
  },
  {
    name: "Welcome Email",
    type: "SYSTEM",
    subject: "Welcome to {school_name}",
    body: "Hello {student_name},\n\nWelcome to {school_name}. Your admission number is {admission_no}.\n\nRegards,\nAdmin",
    sortOrder: 2,
  },
  {
    name: "Attendance Alert",
    type: "TRANSACTIONAL",
    subject: "Attendance update for {student_name}",
    body: "Dear Parent,\n\n{student_name} was marked {status} on {date}.\n\nRegards,\n{school_name}",
    sortOrder: 3,
  },
  {
    name: "General Notice",
    type: "PROMOTIONAL",
    subject: "Notice from {school_name}",
    body: "Dear Parent/Student,\n\n{message}\n\nRegards,\n{school_name}",
    sortOrder: 4,
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

function encryptionToSecure(encryption: EmailEncryption, port: number) {
  if (encryption === "SSL") return true;
  if (encryption === "NONE") return false;
  return port === 465;
}

async function ensureDefaults(tenantId: string) {
  const [gatewayCount, templateCount] = await Promise.all([
    prisma.emailGateway.count({ where: { tenantId } }),
    prisma.emailTemplate.count({ where: { tenantId } }),
  ]);

  if (gatewayCount === 0) {
    const integration = await getTenantIntegration(tenantId, "EMAIL");
    const config = asObject(integration?.config);
    const secrets = integration?.secrets ?? {};
    const host = str(config.host ?? config.smtpHost);
    const user = str(secrets.user ?? secrets.username ?? config.user);
    const pass = str(secrets.pass ?? secrets.password);
    const fromEmail = str(config.from ?? config.fromEmail) || user || "noreply@school.local";
    const port = Number(config.port ?? config.smtpPort ?? 587) || 587;
    const secure = Boolean(config.secure ?? port === 465);

    await prisma.emailGateway.create({
      data: {
        tenantId,
        name: str(config.gatewayName) || "SMTP Primary",
        host: host || "smtp.example.com",
        port,
        encryption: secure ? "SSL" : "STARTTLS",
        username: user || "apikey",
        encryptedSecrets: pass ? encryptSecrets({ pass }) : null,
        fromEmail,
        fromName: str(config.fromName) || null,
        replyToEmail: str(config.replyTo ?? config.replyToEmail) || null,
        ccEmail: str(config.ccEmail) || null,
        isActive: Boolean(integration?.isEnabled && host && user && pass),
        isDefault: true,
        sortOrder: 1,
      },
    });
  }

  if (templateCount === 0) {
    await prisma.emailTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((item) => ({
        tenantId,
        name: item.name,
        type: item.type,
        subject: item.subject,
        body: item.body,
        isDefault: item.isDefault ?? false,
        isActive: true,
        sortOrder: item.sortOrder,
      })),
    });
  }
}

async function syncDefaultToIntegration(tenantId: string) {
  const gateway = await prisma.emailGateway.findFirst({
    where: { tenantId, isDefault: true, isActive: true },
  });
  if (!gateway) {
    const anyActive = await prisma.emailGateway.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    if (!anyActive) {
      await updateIntegrationSetting(tenantId, "EMAIL", {
        provider: "smtp",
        isEnabled: false,
        config: {},
      });
      return;
    }
    await prisma.emailGateway.update({
      where: { id: anyActive.id },
      data: { isDefault: true },
    });
    return syncDefaultToIntegration(tenantId);
  }

  const secrets = decryptSecrets(gateway.encryptedSecrets);
  await updateIntegrationSetting(tenantId, "EMAIL", {
    provider: "smtp",
    isEnabled: gateway.isActive,
    config: {
      gatewayName: gateway.name,
      host: gateway.host,
      port: gateway.port,
      secure: encryptionToSecure(gateway.encryption, gateway.port),
      encryption: gateway.encryption,
      from: gateway.fromEmail,
      fromEmail: gateway.fromEmail,
      fromName: gateway.fromName ?? "",
      replyTo: gateway.replyToEmail ?? "",
      ccEmail: gateway.ccEmail ?? "",
      user: gateway.username,
    } as Prisma.InputJsonValue,
    ...(secrets.pass ? { secrets: { user: gateway.username, pass: secrets.pass } } : {}),
  });
}

function mapGateway(item: {
  id: string;
  name: string;
  host: string;
  port: number;
  encryption: EmailEncryption;
  username: string;
  encryptedSecrets: string | null;
  fromEmail: string;
  fromName: string | null;
  replyToEmail: string | null;
  ccEmail: string | null;
  isActive: boolean;
  isDefault: boolean;
  balanceCredits: number;
  lastTestStatus: string | null;
  lastTestedAt: Date | null;
  updatedAt: Date;
  sortOrder: number;
}) {
  return {
    id: item.id,
    name: item.name,
    host: item.host,
    port: item.port,
    encryption: item.encryption,
    username: item.username,
    hasSecrets: Boolean(item.encryptedSecrets),
    fromEmail: item.fromEmail,
    fromName: item.fromName,
    replyToEmail: item.replyToEmail,
    ccEmail: item.ccEmail,
    isActive: item.isActive,
    isDefault: item.isDefault,
    balanceCredits: item.balanceCredits,
    lastTestStatus: item.lastTestStatus,
    lastTestedAt: item.lastTestedAt?.toISOString() ?? null,
    lastTestedAtLabel: item.lastTestedAt ? formatUpdatedAt(item.lastTestedAt) : "—",
    updatedAtLabel: formatUpdatedAt(item.updatedAt),
    sortOrder: item.sortOrder,
  };
}

export async function getEmailGatewaySetup(tenantId: string) {
  await ensureDefaults(tenantId);

  const [gateways, templates, recent, todayCount, monthLogs] = await Promise.all([
    prisma.emailGateway.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.emailTemplate.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.emailDeliveryLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.emailDeliveryLog.count({
      where: { tenantId, status: "SUCCESS", createdAt: { gte: startOfDay() } },
    }),
    prisma.emailDeliveryLog.findMany({
      where: { tenantId, status: "SUCCESS", createdAt: { gte: startOfMonth() } },
      select: { category: true },
    }),
  ]);

  let transactional = 0;
  let promotional = 0;
  let system = 0;
  for (const log of monthLogs) {
    const cat = (log.category ?? "").toUpperCase();
    if (cat === "PROMOTIONAL") promotional += 1;
    else if (cat === "SYSTEM") system += 1;
    else transactional += 1;
  }
  const usageTotal = transactional + promotional + system || 1;
  const activeDefault =
    gateways.find((g) => g.isDefault && g.isActive) ?? gateways.find((g) => g.isActive) ?? null;

  return {
    gateways: gateways.map(mapGateway),
    editingGatewayId: activeDefault?.id ?? gateways[0]?.id ?? null,
    templates: templates.map((item, index) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      subject: item.subject,
      body: item.body,
      isDefault: item.isDefault,
      isActive: item.isActive,
      updatedAtLabel: formatUpdatedAt(item.updatedAt),
      index: index + 1,
    })),
    recentActivity: recent.map((item) => ({
      id: item.id,
      toEmail: item.toEmail,
      subject: item.subject,
      bodyPreview: item.bodyPreview,
      status: item.status,
      gatewayName: item.gatewayName,
      category: item.category,
      errorMessage: item.errorMessage,
      createdAtLabel: formatUpdatedAt(item.createdAt),
    })),
    usage: {
      breakdown: [
        {
          key: "transactional",
          label: "Transactional",
          count: transactional,
          percent: Math.round((transactional / usageTotal) * 1000) / 10,
        },
        {
          key: "promotional",
          label: "Promotional",
          count: promotional,
          percent: Math.round((promotional / usageTotal) * 1000) / 10,
        },
        {
          key: "system",
          label: "System",
          count: system,
          percent: Math.round((system / usageTotal) * 1000) / 10,
        },
      ],
    },
    stats: {
      activeGateway: activeDefault?.name ?? "Not configured",
      isActive: Boolean(activeDefault?.isActive),
      isDefault: Boolean(activeDefault?.isDefault),
      todaySent: todayCount,
      monthlyUsage: monthLogs.length,
      emailBalance: activeDefault?.balanceCredits ?? 0,
      gatewayCount: gateways.length,
      templateCount: templates.length,
    },
  };
}

export type EmailGatewayInput = {
  id?: string;
  name: string;
  host: string;
  port?: number;
  encryption?: EmailEncryption;
  username: string;
  password?: string;
  fromEmail: string;
  fromName?: string | null;
  replyToEmail?: string | null;
  ccEmail?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  balanceCredits?: number;
};

export async function upsertEmailGateway(tenantId: string, input: EmailGatewayInput) {
  const name = input.name.trim();
  const host = input.host.trim();
  const username = input.username.trim();
  const fromEmail = input.fromEmail.trim();
  if (!name || !host || !username || !fromEmail) {
    throw new AppError(400, "Name, host, username and from email are required", "EMAIL_GATEWAY_INVALID");
  }

  const port = input.port ?? 587;
  const encryption = input.encryption ?? "STARTTLS";

  if (input.isDefault) {
    await prisma.emailGateway.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  if (input.id) {
    const found = await prisma.emailGateway.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Gateway not found", "EMAIL_GATEWAY_NOT_FOUND");

    const secrets = decryptSecrets(found.encryptedSecrets);
    if (input.password?.trim()) secrets.pass = input.password.trim();

    await prisma.emailGateway.update({
      where: { id: input.id },
      data: {
        name,
        host,
        port,
        encryption,
        username,
        encryptedSecrets: secrets.pass ? encryptSecrets(secrets) : found.encryptedSecrets,
        fromEmail,
        fromName: input.fromName?.trim() || null,
        replyToEmail: input.replyToEmail?.trim() || null,
        ccEmail: input.ccEmail?.trim() || null,
        isActive: input.isActive ?? found.isActive,
        isDefault: input.isDefault ?? found.isDefault,
        ...(input.balanceCredits !== undefined
          ? { balanceCredits: input.balanceCredits }
          : {}),
      },
    });
  } else {
    const exists = await prisma.emailGateway.findFirst({
      where: tenantScope(tenantId, { name }),
    });
    if (exists) throw new AppError(409, "Gateway name already exists", "EMAIL_GATEWAY_EXISTS");
    if (!input.password?.trim()) {
      throw new AppError(400, "Password is required for a new gateway", "EMAIL_PASSWORD_REQUIRED");
    }
    const maxSort = await prisma.emailGateway.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    const count = await prisma.emailGateway.count({ where: { tenantId } });
    await prisma.emailGateway.create({
      data: {
        tenantId,
        name,
        host,
        port,
        encryption,
        username,
        encryptedSecrets: encryptSecrets({ pass: input.password.trim() }),
        fromEmail,
        fromName: input.fromName?.trim() || null,
        replyToEmail: input.replyToEmail?.trim() || null,
        ccEmail: input.ccEmail?.trim() || null,
        isActive: input.isActive ?? true,
        isDefault: input.isDefault ?? count === 0,
        balanceCredits: input.balanceCredits ?? 0,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  await syncDefaultToIntegration(tenantId);
  return getEmailGatewaySetup(tenantId);
}

export async function cloneEmailGateway(tenantId: string, id: string) {
  const found = await prisma.emailGateway.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Gateway not found", "EMAIL_GATEWAY_NOT_FOUND");

  let name = `${found.name} Copy`;
  let suffix = 2;
  while (await prisma.emailGateway.findFirst({ where: tenantScope(tenantId, { name }) })) {
    name = `${found.name} Copy ${suffix}`;
    suffix += 1;
  }

  const maxSort = await prisma.emailGateway.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });

  await prisma.emailGateway.create({
    data: {
      tenantId,
      name,
      host: found.host,
      port: found.port,
      encryption: found.encryption,
      username: found.username,
      encryptedSecrets: found.encryptedSecrets,
      fromEmail: found.fromEmail,
      fromName: found.fromName,
      replyToEmail: found.replyToEmail,
      ccEmail: found.ccEmail,
      isActive: false,
      isDefault: false,
      balanceCredits: found.balanceCredits,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return getEmailGatewaySetup(tenantId);
}

export async function deleteEmailGateway(tenantId: string, id: string) {
  const found = await prisma.emailGateway.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Gateway not found", "EMAIL_GATEWAY_NOT_FOUND");
  await prisma.emailGateway.delete({ where: { id } });
  if (found.isDefault) {
    const next = await prisma.emailGateway.findFirst({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.emailGateway.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
  await syncDefaultToIntegration(tenantId);
  return getEmailGatewaySetup(tenantId);
}

export async function testEmailGateway(tenantId: string, id?: string) {
  const gateway = id
    ? await prisma.emailGateway.findFirst({ where: tenantScope(tenantId, { id }) })
    : await prisma.emailGateway.findFirst({
        where: { tenantId, isDefault: true },
      });
  if (!gateway) throw new AppError(404, "Gateway not found", "EMAIL_GATEWAY_NOT_FOUND");

  const secrets = decryptSecrets(gateway.encryptedSecrets);
  if (!secrets.pass) {
    throw new AppError(400, "Gateway password is missing", "EMAIL_PASSWORD_MISSING");
  }

  const transporter = nodemailer.createTransport({
    host: gateway.host,
    port: gateway.port,
    secure: encryptionToSecure(gateway.encryption, gateway.port),
    auth: { user: gateway.username, pass: secrets.pass },
  });

  try {
    await transporter.verify();
    await prisma.emailGateway.update({
      where: { id: gateway.id },
      data: { lastTestStatus: "SUCCESS", lastTestedAt: new Date() },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "SMTP verify failed";
    await prisma.emailGateway.update({
      where: { id: gateway.id },
      data: { lastTestStatus: "FAILED", lastTestedAt: new Date() },
    });
    throw new AppError(502, `Email gateway test failed: ${message}`, "EMAIL_TEST_FAILED");
  }

  await syncDefaultToIntegration(tenantId);
  return getEmailGatewaySetup(tenantId);
}

export type EmailTemplateInput = {
  id?: string;
  name: string;
  type?: EmailTemplateType;
  subject: string;
  body: string;
  isDefault?: boolean;
  isActive?: boolean;
};

export async function upsertEmailTemplate(tenantId: string, input: EmailTemplateInput) {
  const name = input.name.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!name || !subject || !body) {
    throw new AppError(400, "Name, subject and body are required", "EMAIL_TEMPLATE_INVALID");
  }

  if (input.isDefault) {
    await prisma.emailTemplate.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  if (input.id) {
    const found = await prisma.emailTemplate.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Template not found", "EMAIL_TEMPLATE_NOT_FOUND");
    await prisma.emailTemplate.update({
      where: { id: input.id },
      data: {
        name,
        subject,
        body,
        type: input.type ?? found.type,
        isDefault: input.isDefault ?? found.isDefault,
        isActive: input.isActive ?? found.isActive,
      },
    });
  } else {
    const exists = await prisma.emailTemplate.findFirst({
      where: tenantScope(tenantId, { name }),
    });
    if (exists) throw new AppError(409, "Template name already exists", "EMAIL_TEMPLATE_EXISTS");
    const maxSort = await prisma.emailTemplate.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    await prisma.emailTemplate.create({
      data: {
        tenantId,
        name,
        subject,
        body,
        type: input.type ?? "GENERAL",
        isDefault: input.isDefault ?? false,
        isActive: input.isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }

  return getEmailGatewaySetup(tenantId);
}

export async function deleteEmailTemplate(tenantId: string, id: string) {
  const found = await prisma.emailTemplate.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Template not found", "EMAIL_TEMPLATE_NOT_FOUND");
  await prisma.emailTemplate.delete({ where: { id } });
  return getEmailGatewaySetup(tenantId);
}

export async function logEmailDelivery(input: {
  tenantId: string;
  toEmail: string;
  subject: string;
  body: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  gatewayName?: string | null;
  category?: string | null;
  errorMessage?: string | null;
}) {
  await prisma.emailDeliveryLog.create({
    data: {
      tenantId: input.tenantId,
      toEmail: input.toEmail,
      subject: input.subject.slice(0, 200),
      bodyPreview: input.body.slice(0, 160),
      status: input.status,
      gatewayName: input.gatewayName ?? null,
      category: input.category ?? null,
      errorMessage: input.errorMessage ?? null,
    },
  });
}
