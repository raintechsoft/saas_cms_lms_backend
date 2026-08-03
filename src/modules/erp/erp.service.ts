import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  type CustomFieldTarget,
  type CustomFieldType,
  type ErpSettingCategory,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

function encryptSecrets(secrets: Record<string, string>) {
  const key = createHash("sha256")
    .update(env.SETTINGS_ENCRYPTION_KEY ?? env.JWT_SECRET)
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(secrets), "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecrets(payload: string | null | undefined): Record<string, string> {
  if (!payload) return {};
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) return {};
  try {
    const key = createHash("sha256")
      .update(env.SETTINGS_ENCRYPTION_KEY ?? env.JWT_SECRET)
      .digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const integrationSelect = {
  id: true,
  category: true,
  provider: true,
  isEnabled: true,
  config: true,
  updatedAt: true,
  encryptedSecrets: true,
} satisfies Prisma.ErpIntegrationSettingSelect;

export async function getTenantIntegration(
  tenantId: string,
  category: ErpSettingCategory,
) {
  const row = await prisma.erpIntegrationSetting.findFirst({
    where: tenantScope(tenantId, { category }),
    select: integrationSelect,
  });
  if (!row) return null;
  return {
    ...row,
    secrets: decryptSecrets(row.encryptedSecrets),
  };
}

export async function getErpSetup(tenantId: string) {
  const [
    tenant,
    settings,
    feeSetting,
    integrations,
    paymentMethods,
    modules,
    languages,
    customFields,
    systemFields,
    shortcuts,
    profileRights,
    holidays,
    folders,
    documents,
    backups,
    sessions,
    students,
  ] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, type: true, productMode: true, branding: true },
    }),
    prisma.tenantSetting.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    }),
    prisma.tenantFeeSetting.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    }),
    prisma.erpIntegrationSetting.findMany({
      where: tenantScope(tenantId, {}),
      select: integrationSelect,
      orderBy: { category: "asc" },
    }),
    prisma.tenantPaymentMethod.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.tenantModuleSetting.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { moduleKey: "asc" },
    }),
    prisma.tenantLanguage.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.customField.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: [{ target: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.systemFieldSetting.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: [{ target: "asc" }, { fieldKey: "asc" }],
    }),
    prisma.shortcutKeySetting.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { actionKey: "asc" },
    }),
    prisma.studentProfileRight.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { fieldKey: "asc" },
    }),
    prisma.holiday.findMany({
      where: tenantScope(tenantId, {}),
      include: { academicSession: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.studentDocumentFolder.findMany({
      where: tenantScope(tenantId, {}),
      include: { _count: { select: { documents: true, children: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.studentDocument.findMany({
      where: tenantScope(tenantId, { deletedAt: null }),
      include: { student: true, folder: true, uploadedBy: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.configurationBackup.findMany({
      where: tenantScope(tenantId, {}),
      select: {
        id: true,
        name: true,
        createdAt: true,
        restoredAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
        restoredBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.academicSession.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { startDate: "desc" },
    }),
    prisma.student.findMany({
      where: tenantScope(tenantId, {}),
      select: { id: true, admissionNumber: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500,
    }),
  ]);
  return {
    tenant,
    settings,
    feeSetting,
    integrations: integrations.map(({ encryptedSecrets, ...item }) => ({
      ...item,
      hasSecrets: Boolean(encryptedSecrets),
    })),
    paymentMethods,
    modules,
    languages,
    customFields,
    systemFields,
    shortcuts,
    profileRights,
    holidays,
    folders,
    documents,
    backups,
    sessions,
    students,
  };
}

export async function updateIntegrationSetting(
  tenantId: string,
  category: ErpSettingCategory,
  input: {
    provider?: string | null;
    isEnabled: boolean;
    config: Prisma.InputJsonValue;
    secrets?: Record<string, string>;
  },
) {
  const data = {
    provider: input.provider,
    isEnabled: input.isEnabled,
    config: input.config,
    ...(input.secrets && Object.keys(input.secrets).length
      ? { encryptedSecrets: encryptSecrets(input.secrets) }
      : {}),
  };
  const setting = await prisma.erpIntegrationSetting.upsert({
    where: { tenantId_category: { tenantId, category } },
    create: { tenantId, category, ...data },
    update: data,
    select: integrationSelect,
  });
  const { encryptedSecrets, ...safe } = setting;
  return { ...safe, hasSecrets: Boolean(encryptedSecrets) };
}

export async function createPaymentMethod(
  tenantId: string,
  input: {
    code: string;
    name: string;
    instructions?: string | null;
    config?: Prisma.InputJsonValue;
    isActive?: boolean;
    sortOrder?: number;
  },
) {
  return prisma.tenantPaymentMethod.create({ data: { tenantId, ...input } });
}

export async function updatePaymentMethod(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    instructions?: string | null;
    config?: Prisma.InputJsonValue;
    isActive?: boolean;
    sortOrder?: number;
  },
) {
  const exists = await prisma.tenantPaymentMethod.count({
    where: tenantScope(tenantId, { id }),
  });
  if (!exists) throw new AppError(404, "Payment method not found", "PAYMENT_METHOD_NOT_FOUND");
  return prisma.tenantPaymentMethod.update({ where: { id }, data: input });
}

export async function deletePaymentMethod(tenantId: string, id: string) {
  const result = await prisma.tenantPaymentMethod.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Payment method not found", "PAYMENT_METHOD_NOT_FOUND");
  return { deleted: true };
}

export function upsertModuleSetting(
  tenantId: string,
  moduleKey: string,
  input: { adminEnabled: boolean; studentEnabled: boolean; parentEnabled: boolean },
) {
  return prisma.tenantModuleSetting.upsert({
    where: { tenantId_moduleKey: { tenantId, moduleKey } },
    create: { tenantId, moduleKey, ...input },
    update: input,
  });
}

export async function upsertLanguage(
  tenantId: string,
  input: { code: string; name: string; isEnabled: boolean; isDefault: boolean },
) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.tenantLanguage.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }
    return tx.tenantLanguage.upsert({
      where: { tenantId_code: { tenantId, code: input.code } },
      create: { tenantId, ...input },
      update: input,
    });
  });
}

export function createCustomField(
  tenantId: string,
  input: {
    target: CustomFieldTarget;
    key: string;
    label: string;
    type: CustomFieldType;
    options?: Prisma.InputJsonValue;
    isRequired?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  },
) {
  return prisma.customField.create({ data: { tenantId, ...input } });
}

export async function updateCustomField(
  tenantId: string,
  id: string,
  input: {
    label?: string;
    options?: Prisma.InputJsonValue;
    isRequired?: boolean;
    isActive?: boolean;
    sortOrder?: number;
  },
) {
  const exists = await prisma.customField.count({ where: tenantScope(tenantId, { id }) });
  if (!exists) throw new AppError(404, "Custom field not found", "CUSTOM_FIELD_NOT_FOUND");
  return prisma.customField.update({ where: { id }, data: input });
}

export async function deleteCustomField(tenantId: string, id: string) {
  const result = await prisma.customField.deleteMany({ where: tenantScope(tenantId, { id }) });
  if (!result.count) throw new AppError(404, "Custom field not found", "CUSTOM_FIELD_NOT_FOUND");
  return { deleted: true };
}

export function upsertSystemField(
  tenantId: string,
  fieldKey: string,
  input: {
    target: CustomFieldTarget;
    label: string;
    isEnabled: boolean;
    isRequired: boolean;
  },
) {
  return prisma.systemFieldSetting.upsert({
    where: {
      tenantId_target_fieldKey: { tenantId, target: input.target, fieldKey },
    },
    create: { tenantId, fieldKey, ...input },
    update: input,
  });
}

export function upsertShortcut(
  tenantId: string,
  actionKey: string,
  input: { shortcut: string; isEnabled: boolean },
) {
  return prisma.shortcutKeySetting.upsert({
    where: { tenantId_actionKey: { tenantId, actionKey } },
    create: { tenantId, actionKey, ...input },
    update: input,
  });
}

export function upsertProfileRight(
  tenantId: string,
  fieldKey: string,
  input: {
    studentVisible: boolean;
    parentVisible: boolean;
    studentEditable: boolean;
    parentEditable: boolean;
  },
) {
  return prisma.studentProfileRight.upsert({
    where: { tenantId_fieldKey: { tenantId, fieldKey } },
    create: { tenantId, fieldKey, ...input },
    update: input,
  });
}

export async function createHoliday(
  tenantId: string,
  input: {
    academicSessionId?: string | null;
    title: string;
    startDate: Date;
    endDate: Date;
    description?: string | null;
  },
) {
  if (input.endDate < input.startDate) {
    throw new AppError(400, "Holiday end date must be on or after start date", "INVALID_DATE_RANGE");
  }
  if (input.academicSessionId) {
    const session = await prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: input.academicSessionId }),
    });
    if (!session) throw new AppError(400, "Academic session is invalid", "INVALID_SESSION");
    if (input.startDate < session.startDate || input.endDate > session.endDate) {
      throw new AppError(400, "Holiday must be within the academic session", "DATE_OUTSIDE_SESSION");
    }
  }
  return prisma.holiday.create({ data: { tenantId, ...input } });
}

export async function deleteHoliday(tenantId: string, id: string) {
  const result = await prisma.holiday.deleteMany({ where: tenantScope(tenantId, { id }) });
  if (!result.count) throw new AppError(404, "Holiday not found", "HOLIDAY_NOT_FOUND");
  return { deleted: true };
}

export async function createDocumentFolder(
  tenantId: string,
  input: { name: string; parentId?: string | null },
) {
  if (input.parentId) {
    const parent = await prisma.studentDocumentFolder.findFirst({
      where: tenantScope(tenantId, { id: input.parentId }),
    });
    if (!parent) throw new AppError(400, "Parent folder is invalid", "INVALID_FOLDER");
  }
  return prisma.studentDocumentFolder.create({ data: { tenantId, ...input } });
}

export async function createStudentDocument(
  tenantId: string,
  userId: string,
  input: {
    studentId: string;
    folderId: string;
    name: string;
    fileUrl: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
  },
) {
  const [student, folder] = await Promise.all([
    prisma.student.findFirst({ where: tenantScope(tenantId, { id: input.studentId }) }),
    prisma.studentDocumentFolder.findFirst({
      where: tenantScope(tenantId, { id: input.folderId }),
    }),
  ]);
  if (!student || !folder) {
    throw new AppError(400, "Student or document folder is invalid", "INVALID_DOCUMENT_REFERENCE");
  }
  return prisma.studentDocument.create({
    data: { tenantId, uploadedById: userId, ...input },
    include: { student: true, folder: true },
  });
}

export async function deleteStudentDocument(
  tenantId: string,
  id: string,
  deletedById?: string,
  reason?: string,
) {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < 3) {
    throw new AppError(400, "Delete reason is required (min 3 characters)", "REASON_REQUIRED");
  }
  const existing = await prisma.studentDocument.findFirst({
    where: tenantScope(tenantId, { id, deletedAt: null }),
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Student document not found", "DOCUMENT_NOT_FOUND");
  await prisma.studentDocument.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deleteReason: trimmed.slice(0, 500),
      deletedById: deletedById ?? null,
    },
  });
  return { deleted: true };
}

export async function createConfigurationBackup(
  tenantId: string,
  userId: string,
  name: string,
) {
  const [
    tenant,
    settings,
    feeSetting,
    integrations,
    paymentMethods,
    modules,
    languages,
    customFields,
    systemFields,
    shortcuts,
    profileRights,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { branding: true } }),
    prisma.tenantSetting.findUnique({ where: { tenantId } }),
    prisma.tenantFeeSetting.findUnique({ where: { tenantId } }),
    prisma.erpIntegrationSetting.findMany({ where: tenantScope(tenantId, {}) }),
    prisma.tenantPaymentMethod.findMany({ where: tenantScope(tenantId, {}) }),
    prisma.tenantModuleSetting.findMany({ where: tenantScope(tenantId, {}) }),
    prisma.tenantLanguage.findMany({ where: tenantScope(tenantId, {}) }),
    prisma.customField.findMany({ where: tenantScope(tenantId, {}) }),
    prisma.systemFieldSetting.findMany({ where: tenantScope(tenantId, {}) }),
    prisma.shortcutKeySetting.findMany({ where: tenantScope(tenantId, {}) }),
    prisma.studentProfileRight.findMany({ where: tenantScope(tenantId, {}) }),
  ]);
  const snapshot = JSON.parse(
    JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      tenant,
      settings,
      feeSetting,
      integrations,
      paymentMethods,
      modules,
      languages,
      customFields,
      systemFields,
      shortcuts,
      profileRights,
    }),
  ) as Prisma.InputJsonValue;
  return prisma.configurationBackup.create({
    data: { tenantId, createdById: userId, name, snapshot },
    select: { id: true, name: true, createdAt: true },
  });
}

type SnapshotRecord = Record<string, unknown>;
interface ConfigurationSnapshot {
  tenant?: { branding?: Prisma.InputJsonValue };
  settings?: SnapshotRecord | null;
  feeSetting?: SnapshotRecord | null;
  integrations?: SnapshotRecord[];
  paymentMethods?: SnapshotRecord[];
  modules?: SnapshotRecord[];
  languages?: SnapshotRecord[];
  customFields?: SnapshotRecord[];
  systemFields?: SnapshotRecord[];
  shortcuts?: SnapshotRecord[];
  profileRights?: SnapshotRecord[];
}

function withoutMeta(record: SnapshotRecord) {
  const {
    id: _id,
    tenantId: _tenantId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...data
  } = record;
  return data;
}

export async function restoreConfigurationBackup(
  tenantId: string,
  userId: string,
  backupId: string,
) {
  const backup = await prisma.configurationBackup.findFirst({
    where: tenantScope(tenantId, { id: backupId }),
  });
  if (!backup) throw new AppError(404, "Configuration backup not found", "BACKUP_NOT_FOUND");
  const snapshot = backup.snapshot as unknown as ConfigurationSnapshot;
  await prisma.$transaction(async (tx) => {
    if (snapshot.tenant?.branding !== undefined) {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { branding: snapshot.tenant.branding },
      });
    }
    if (snapshot.settings) {
      const data = withoutMeta(snapshot.settings) as Prisma.TenantSettingUncheckedUpdateInput;
      await tx.tenantSetting.upsert({
        where: { tenantId },
        create: {
          ...(data as Prisma.TenantSettingUncheckedCreateInput),
          tenantId,
        },
        update: data,
      });
    }
    if (snapshot.feeSetting) {
      const data = withoutMeta(snapshot.feeSetting) as Prisma.TenantFeeSettingUncheckedUpdateInput;
      await tx.tenantFeeSetting.upsert({
        where: { tenantId },
        create: {
          ...(data as Prisma.TenantFeeSettingUncheckedCreateInput),
          tenantId,
        },
        update: data,
      });
    }
    await Promise.all([
      tx.erpIntegrationSetting.deleteMany({ where: { tenantId } }),
      tx.tenantPaymentMethod.deleteMany({ where: { tenantId } }),
      tx.tenantModuleSetting.deleteMany({ where: { tenantId } }),
      tx.tenantLanguage.deleteMany({ where: { tenantId } }),
      tx.customField.deleteMany({ where: { tenantId } }),
      tx.systemFieldSetting.deleteMany({ where: { tenantId } }),
      tx.shortcutKeySetting.deleteMany({ where: { tenantId } }),
      tx.studentProfileRight.deleteMany({ where: { tenantId } }),
    ]);
    for (const record of snapshot.integrations ?? []) {
      await tx.erpIntegrationSetting.create({
        data: {
          tenantId,
          ...(withoutMeta(record) as Omit<
            Prisma.ErpIntegrationSettingUncheckedCreateInput,
            "tenantId"
          >),
        },
      });
    }
    for (const record of snapshot.paymentMethods ?? []) {
      await tx.tenantPaymentMethod.create({
        data: { tenantId, ...withoutMeta(record) } as Prisma.TenantPaymentMethodUncheckedCreateInput,
      });
    }
    for (const record of snapshot.modules ?? []) {
      await tx.tenantModuleSetting.create({
        data: { tenantId, ...withoutMeta(record) } as Prisma.TenantModuleSettingUncheckedCreateInput,
      });
    }
    for (const record of snapshot.languages ?? []) {
      await tx.tenantLanguage.create({
        data: { tenantId, ...withoutMeta(record) } as Prisma.TenantLanguageUncheckedCreateInput,
      });
    }
    for (const record of snapshot.customFields ?? []) {
      await tx.customField.create({
        data: { tenantId, ...withoutMeta(record) } as Prisma.CustomFieldUncheckedCreateInput,
      });
    }
    for (const record of snapshot.systemFields ?? []) {
      await tx.systemFieldSetting.create({
        data: { tenantId, ...withoutMeta(record) } as Prisma.SystemFieldSettingUncheckedCreateInput,
      });
    }
    for (const record of snapshot.shortcuts ?? []) {
      await tx.shortcutKeySetting.create({
        data: { tenantId, ...withoutMeta(record) } as Prisma.ShortcutKeySettingUncheckedCreateInput,
      });
    }
    for (const record of snapshot.profileRights ?? []) {
      await tx.studentProfileRight.create({
        data: { tenantId, ...withoutMeta(record) } as Prisma.StudentProfileRightUncheckedCreateInput,
      });
    }
    await tx.configurationBackup.update({
      where: { id: backupId },
      data: { restoredById: userId, restoredAt: new Date() },
    });
  });
  return { restored: true, backupId };
}
