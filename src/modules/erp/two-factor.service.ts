import type { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

const ROLE_META: Record<
  string,
  { label: string; shortLabel: string; color: string; demoRate: number }
> = {
  INSTITUTION_ADMIN: {
    label: "Administrator",
    shortLabel: "Admin",
    color: "#7C3AED",
    demoRate: 0.86,
  },
  STAFF: { label: "Staff", shortLabel: "Staff", color: "#10B981", demoRate: 0.71 },
  TEACHER: { label: "Teacher", shortLabel: "Teacher", color: "#F59E0B", demoRate: 0.85 },
  ACCOUNTANT: {
    label: "Accountant",
    shortLabel: "Accountant",
    color: "#6366F1",
    demoRate: 0.8,
  },
  STUDENT: { label: "Student", shortLabel: "Student", color: "#38BDF8", demoRate: 0.71 },
  PARENT: { label: "Parent", shortLabel: "Parent", color: "#2563EB", demoRate: 0.96 },
};

const DEFAULT_ENFORCED = ["INSTITUTION_ADMIN", "STAFF", "TEACHER"];
const DEFAULT_OPTIONAL = ["STUDENT", "PARENT"];

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function roleLabel(code: string) {
  return ROLE_META[code]?.shortLabel || ROLE_META[code]?.label || code;
}

async function ensureTwoFactorSetting(tenantId: string) {
  const existing = await prisma.tenantTwoFactorSetting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.tenantTwoFactorSetting.create({
    data: {
      tenantId,
      enforcedRoleCodes: DEFAULT_ENFORCED,
      optionalRoleCodes: DEFAULT_OPTIONAL,
    },
  });
}

export async function getTwoFactorSetup(tenantId: string) {
  const setting = await ensureTwoFactorSetting(tenantId);

  const roles = await prisma.role.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  // Prefer known portal/staff roles; include any extras from tenant.
  const preferredOrder = [
    "INSTITUTION_ADMIN",
    "STAFF",
    "TEACHER",
    "ACCOUNTANT",
    "STUDENT",
    "PARENT",
  ];
  const roleMap = new Map(roles.map((r) => [r.code, r]));
  const orderedCodes = [
    ...preferredOrder.filter((code) => roleMap.has(code)),
    ...roles.map((r) => r.code).filter((code) => !preferredOrder.includes(code)),
  ];

  const byRole = orderedCodes.map((code) => {
    const role = roleMap.get(code)!;
    const meta = ROLE_META[code] || {
      label: role.name,
      shortLabel: role.name,
      color: "#8B5CF6",
      demoRate: 0.75,
    };
    // Demo enrollment until per-user 2FA flags exist
    const totalUsers = Math.max(role._count.users, code === "INSTITUTION_ADMIN" ? 1 : 0);
    const demoTotal =
      totalUsers > 0
        ? totalUsers
        : code === "INSTITUTION_ADMIN"
          ? 28
          : code === "STAFF"
            ? 135
            : code === "TEACHER"
              ? 92
              : code === "STUDENT"
                ? 45
                : code === "PARENT"
                  ? 25
                  : 12;
    const enabledUsers = Math.min(demoTotal, Math.round(demoTotal * meta.demoRate));
    const percent = demoTotal ? Math.round((enabledUsers / demoTotal) * 100) : 0;
    return {
      code,
      label: meta.label,
      shortLabel: meta.shortLabel,
      color: meta.color,
      totalUsers: demoTotal,
      enabledUsers,
      percent,
    };
  });

  const totalUsers = byRole.reduce((sum, row) => sum + row.totalUsers, 0);
  const enabledUsers = byRole.reduce((sum, row) => sum + row.enabledUsers, 0);
  const coveragePercent = totalUsers ? Math.round((enabledUsers / totalUsers) * 100) : 0;

  const enforcedRoleCodes = asStringArray(setting.enforcedRoleCodes, DEFAULT_ENFORCED);
  const optionalRoleCodes = asStringArray(setting.optionalRoleCodes, DEFAULT_OPTIONAL);

  return {
    overview: {
      enabled: setting.enabled,
      enforcedRoles: enforcedRoleCodes.map(roleLabel),
      optionalRoles: optionalRoleCodes.map(roleLabel),
      enforcedCount: enforcedRoleCodes.length,
      optionalCount: optionalRoleCodes.length,
      coveragePercent,
      enabledUsers,
      totalUsers,
      statusMessage: setting.enabled
        ? "Two-Factor Authentication is active. Users will be prompted to verify using their selected method."
        : "Two-Factor Authentication is currently disabled for this institution.",
    },
    methods: [
      {
        key: "totp",
        label: "Authenticator App (TOTP)",
        description:
          "Users can verify using apps like Google Authenticator, Microsoft Authenticator or Authy.",
        enabled: setting.methodTotp,
        color: "#7C3AED",
        configurable: true,
      },
      {
        key: "sms",
        label: "SMS Verification",
        description: "Users will receive a one-time code via SMS on their registered mobile number.",
        enabled: setting.methodSms,
        color: "#10B981",
        configurable: true,
      },
      {
        key: "email",
        label: "Email Verification",
        description: "Users will receive a one-time code via email on their registered email address.",
        enabled: setting.methodEmail,
        color: "#F59E0B",
        configurable: true,
      },
      {
        key: "backup",
        label: "Backup Codes",
        description: "Users can use backup codes when other methods are not available.",
        enabled: setting.methodBackupCodes,
        color: "#3B82F6",
        configurable: true,
      },
    ],
    policy: {
      enforcedRoleCodes,
      optionalRoleCodes,
      gracePeriodDays: setting.gracePeriodDays,
      requireOnNewDevices: setting.requireOnNewDevices,
      rememberDeviceDays: setting.rememberDeviceDays,
      maxAttemptsWithout2fa: setting.maxAttemptsWithout2fa,
    },
    backup: {
      generateBackupCodes: setting.generateBackupCodes,
      backupCodesCount: setting.backupCodesCount,
    },
    methodConfig: {
      totpIssuer: setting.totpIssuer,
      smsCodeExpirySeconds: setting.smsCodeExpirySeconds,
      emailCodeExpirySeconds: setting.emailCodeExpirySeconds,
    },
    availableRoles: orderedCodes.map((code) => {
      const role = roleMap.get(code)!;
      const meta = ROLE_META[code];
      return {
        code,
        label: meta?.label || role.name,
        shortLabel: meta?.shortLabel || role.name,
      };
    }),
    coverageByRole: byRole,
    setupFlow: [
      "User logs in with username & password.",
      "System prompts for 2FA verification.",
      "User enters code from selected method.",
      "System verifies the code.",
      "Access granted successfully.",
    ],
    securityTips: [
      "Use an authenticator app for best security.",
      "Do not share your backup codes with anyone.",
      "Keep backup codes in a secure location.",
      "Review 2FA coverage regularly by role.",
    ],
  };
}

export type SaveTwoFactorInput = {
  enabled?: boolean;
  methodTotp?: boolean;
  methodSms?: boolean;
  methodEmail?: boolean;
  methodBackupCodes?: boolean;
  enforcedRoleCodes?: string[];
  optionalRoleCodes?: string[];
  gracePeriodDays?: number;
  requireOnNewDevices?: boolean;
  rememberDeviceDays?: number;
  maxAttemptsWithout2fa?: number;
  generateBackupCodes?: boolean;
  backupCodesCount?: number;
  totpIssuer?: string;
  smsCodeExpirySeconds?: number;
  emailCodeExpirySeconds?: number;
};

export async function saveTwoFactorSettings(tenantId: string, input: SaveTwoFactorInput) {
  await ensureTwoFactorSetting(tenantId);

  if (input.gracePeriodDays != null && (input.gracePeriodDays < 0 || input.gracePeriodDays > 90)) {
    throw new AppError(400, "Grace period must be between 0 and 90 days", "2FA_GRACE_INVALID");
  }
  if (
    input.rememberDeviceDays != null &&
    (input.rememberDeviceDays < 0 || input.rememberDeviceDays > 365)
  ) {
    throw new AppError(400, "Remember device days must be between 0 and 365", "2FA_REMEMBER_INVALID");
  }
  if (
    input.maxAttemptsWithout2fa != null &&
    (input.maxAttemptsWithout2fa < 1 || input.maxAttemptsWithout2fa > 20)
  ) {
    throw new AppError(400, "Max attempts must be between 1 and 20", "2FA_ATTEMPTS_INVALID");
  }
  if (
    input.backupCodesCount != null &&
    ![5, 8, 10, 12, 16].includes(input.backupCodesCount)
  ) {
    throw new AppError(400, "Invalid backup codes count", "2FA_BACKUP_COUNT_INVALID");
  }

  const data: Prisma.TenantTwoFactorSettingUpdateInput = {};
  if (input.enabled != null) data.enabled = input.enabled;
  if (input.methodTotp != null) data.methodTotp = input.methodTotp;
  if (input.methodSms != null) data.methodSms = input.methodSms;
  if (input.methodEmail != null) data.methodEmail = input.methodEmail;
  if (input.methodBackupCodes != null) data.methodBackupCodes = input.methodBackupCodes;
  if (input.enforcedRoleCodes) data.enforcedRoleCodes = input.enforcedRoleCodes;
  if (input.optionalRoleCodes) data.optionalRoleCodes = input.optionalRoleCodes;
  if (input.gracePeriodDays != null) data.gracePeriodDays = input.gracePeriodDays;
  if (input.requireOnNewDevices != null) data.requireOnNewDevices = input.requireOnNewDevices;
  if (input.rememberDeviceDays != null) data.rememberDeviceDays = input.rememberDeviceDays;
  if (input.maxAttemptsWithout2fa != null) {
    data.maxAttemptsWithout2fa = input.maxAttemptsWithout2fa;
  }
  if (input.generateBackupCodes != null) data.generateBackupCodes = input.generateBackupCodes;
  if (input.backupCodesCount != null) data.backupCodesCount = input.backupCodesCount;
  if (input.totpIssuer != null) data.totpIssuer = input.totpIssuer.trim() || "Campus ERP";
  if (input.smsCodeExpirySeconds != null) data.smsCodeExpirySeconds = input.smsCodeExpirySeconds;
  if (input.emailCodeExpirySeconds != null) {
    data.emailCodeExpirySeconds = input.emailCodeExpirySeconds;
  }

  await prisma.tenantTwoFactorSetting.update({
    where: { tenantId },
    data,
  });

  return getTwoFactorSetup(tenantId);
}
