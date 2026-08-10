import type { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

function formatRelative(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatTimeLabel(date: Date) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

async function ensurePolicy(tenantId: string) {
  const existing = await prisma.tenantSessionLoginPolicy.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.tenantSessionLoginPolicy.create({ data: { tenantId } });
}

async function ensureDemoData(tenantId: string) {
  const [sessionCount, activityCount] = await Promise.all([
    prisma.userLoginSession.count({ where: { tenantId } }),
    prisma.loginActivityLog.count({ where: { tenantId } }),
  ]);

  if (sessionCount > 0 && activityCount > 0) return;

  const users = await prisma.user.findMany({
    where: { tenantId, status: "ACTIVE" },
    take: 5,
    orderBy: { lastLoginAt: "desc" },
    include: {
      roles: { include: { role: { select: { name: true, code: true } } }, take: 1 },
    },
  });

  const now = new Date();
  if (sessionCount === 0) {
    const devices = [
      "Windows / Chrome 125",
      "macOS / Safari 17",
      "Android / Chrome Mobile",
      "iOS / Safari",
      "Windows / Edge 124",
    ];
    const locations = [
      "New Delhi, India",
      "Mumbai, India",
      "Bengaluru, India",
      "Hyderabad, India",
      "Pune, India",
    ];
    const ips = [
      "192.168.1.45",
      "10.0.0.22",
      "172.16.4.18",
      "192.168.0.91",
      "10.10.1.8",
    ];

    const rows =
      users.length > 0
        ? users.map((user, index) => ({
            tenantId,
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
            userEmail: user.email,
            roleLabel: user.roles[0]?.role.name || "Staff",
            deviceLabel: devices[index % devices.length],
            ipAddress: ips[index % ips.length],
            location: locations[index % locations.length],
            lastActiveAt: new Date(now.getTime() - (index * 3 + 2) * 60_000),
            isCurrent: index === 0,
          }))
        : [
            {
              tenantId,
              userId: null,
              userName: "John Doe",
              userEmail: "admin@demo-school.local",
              roleLabel: "Admin",
              deviceLabel: "Windows / Chrome 125",
              ipAddress: "192.168.1.45",
              location: "New Delhi, India",
              lastActiveAt: new Date(now.getTime() - 2 * 60_000),
              isCurrent: true,
            },
            {
              tenantId,
              userId: null,
              userName: "Priya Sharma",
              userEmail: "priya@demo-school.local",
              roleLabel: "Teacher",
              deviceLabel: "Android / Chrome Mobile",
              ipAddress: "10.0.0.22",
              location: "Mumbai, India",
              lastActiveAt: new Date(now.getTime() - 18 * 60_000),
              isCurrent: false,
            },
            {
              tenantId,
              userId: null,
              userName: "Amit Verma",
              userEmail: "amit@demo-school.local",
              roleLabel: "Staff",
              deviceLabel: "Windows / Edge 124",
              ipAddress: "172.16.4.18",
              location: "Bengaluru, India",
              lastActiveAt: new Date(now.getTime() - 45 * 60_000),
              isCurrent: false,
            },
          ];

    await prisma.userLoginSession.createMany({ data: rows });
  }

  if (activityCount === 0) {
    const samples = [
      {
        userName: users[0]
          ? `${users[0].firstName} ${users[0].lastName}`.trim()
          : "John Doe",
        userId: users[0]?.id ?? null,
        status: "SUCCESS" as const,
        minutesAgo: 5,
        device: "Windows / Chrome 125",
        ip: "192.168.1.45",
        location: "New Delhi, India",
      },
      {
        userName: "Unknown User",
        userId: null,
        status: "FAILED" as const,
        minutesAgo: 22,
        device: "Linux / Firefox 126",
        ip: "103.21.244.12",
        location: "Unknown",
      },
      {
        userName: users[1]
          ? `${users[1].firstName} ${users[1].lastName}`.trim()
          : "Priya Sharma",
        userId: users[1]?.id ?? null,
        status: "SUCCESS" as const,
        minutesAgo: 40,
        device: "Android / Chrome Mobile",
        ip: "10.0.0.22",
        location: "Mumbai, India",
      },
      {
        userName: users[2]
          ? `${users[2].firstName} ${users[2].lastName}`.trim()
          : "Amit Verma",
        userId: users[2]?.id ?? null,
        status: "FAILED" as const,
        minutesAgo: 95,
        device: "Windows / Edge 124",
        ip: "172.16.4.18",
        location: "Bengaluru, India",
      },
      {
        userName: users[0]
          ? `${users[0].firstName} ${users[0].lastName}`.trim()
          : "John Doe",
        userId: users[0]?.id ?? null,
        status: "SUCCESS" as const,
        minutesAgo: 180,
        device: "macOS / Safari 17",
        ip: "192.168.0.91",
        location: "Hyderabad, India",
      },
    ];

    await prisma.loginActivityLog.createMany({
      data: samples.map((item) => ({
        tenantId,
        userId: item.userId,
        userName: item.userName || "User",
        status: item.status,
        ipAddress: item.ip,
        location: item.location,
        deviceLabel: item.device,
        createdAt: new Date(now.getTime() - item.minutesAgo * 60_000),
      })),
    });
  }
}

export async function getSessionLoginPolicySetup(tenantId: string) {
  const policy = await ensurePolicy(tenantId);
  await ensureDemoData(tenantId);

  const [sessions, activity] = await Promise.all([
    prisma.userLoginSession.findMany({
      where: { tenantId },
      orderBy: { lastActiveAt: "desc" },
      take: 20,
    }),
    prisma.loginActivityLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    policy: {
      sessionTimeoutMinutes: policy.sessionTimeoutMinutes,
      warningBeforeLogoutMinutes: policy.warningBeforeLogoutMinutes,
      forceLogoutOtherDevices: policy.forceLogoutOtherDevices,
      rememberMeEnabled: policy.rememberMeEnabled,
      autoLogoutOnBrowserClose: policy.autoLogoutOnBrowserClose,
      maxLoginAttempts: policy.maxLoginAttempts,
      lockoutDurationMinutes: policy.lockoutDurationMinutes,
      lockAccountAfterMaxAttempts: policy.lockAccountAfterMaxAttempts,
      notifyAdminOnLock: policy.notifyAdminOnLock,
      captchaOnLogin: policy.captchaOnLogin,
      minPasswordLength: policy.minPasswordLength,
      requireUppercase: policy.requireUppercase,
      requireLowercase: policy.requireLowercase,
      requireNumbers: policy.requireNumbers,
      requireSpecialChars: policy.requireSpecialChars,
      passwordExpiryDays: policy.passwordExpiryDays,
      preventPasswordReuseLast: policy.preventPasswordReuseLast,
      allowedIpAddresses: policy.allowedIpAddresses || "",
      blockedIpAddresses: policy.blockedIpAddresses || "",
      restrictToAllowedIps: policy.restrictToAllowedIps,
    },
    activeSessions: sessions.map((row) => ({
      id: row.id,
      userName: row.userName,
      userEmail: row.userEmail,
      roleLabel: row.roleLabel,
      deviceLabel: row.deviceLabel,
      ipAddress: row.ipAddress,
      location: row.location,
      lastActiveLabel: formatRelative(row.lastActiveAt),
      isCurrent: row.isCurrent,
    })),
    loginActivity: activity.map((row) => ({
      id: row.id,
      userName: row.userName,
      status: row.status,
      statusLabel: row.status === "SUCCESS" ? "Success" : "Failed",
      ipAddress: row.ipAddress,
      location: row.location,
      deviceLabel: row.deviceLabel,
      timeLabel: formatTimeLabel(row.createdAt),
    })),
    bestPractices: [
      "Use strong passwords with mixed characters.",
      "Enable Two-Factor Authentication for admin accounts.",
      "Review active sessions regularly and terminate unknown devices.",
      "Keep lockout and timeout settings strict for staff portals.",
      "Do not share login credentials across users.",
    ],
  };
}

export type SaveSessionLoginPolicyInput = {
  sessionTimeoutMinutes?: number;
  warningBeforeLogoutMinutes?: number;
  forceLogoutOtherDevices?: boolean;
  rememberMeEnabled?: boolean;
  autoLogoutOnBrowserClose?: boolean;
  maxLoginAttempts?: number;
  lockoutDurationMinutes?: number;
  lockAccountAfterMaxAttempts?: boolean;
  notifyAdminOnLock?: boolean;
  captchaOnLogin?: boolean;
  minPasswordLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  passwordExpiryDays?: number;
  preventPasswordReuseLast?: number;
  allowedIpAddresses?: string | null;
  blockedIpAddresses?: string | null;
  restrictToAllowedIps?: boolean;
};

export async function saveSessionLoginPolicy(
  tenantId: string,
  input: SaveSessionLoginPolicyInput,
) {
  await ensurePolicy(tenantId);

  if (input.sessionTimeoutMinutes != null && (input.sessionTimeoutMinutes < 1 || input.sessionTimeoutMinutes > 1440)) {
    throw new AppError(400, "Session timeout must be between 1 and 1440 minutes", "SESSION_TIMEOUT_INVALID");
  }
  if (
    input.warningBeforeLogoutMinutes != null &&
    (input.warningBeforeLogoutMinutes < 0 || input.warningBeforeLogoutMinutes > 120)
  ) {
    throw new AppError(400, "Warning minutes must be between 0 and 120", "SESSION_WARNING_INVALID");
  }
  if (input.maxLoginAttempts != null && (input.maxLoginAttempts < 1 || input.maxLoginAttempts > 20)) {
    throw new AppError(400, "Max login attempts must be between 1 and 20", "LOGIN_ATTEMPTS_INVALID");
  }
  if (input.minPasswordLength != null && (input.minPasswordLength < 6 || input.minPasswordLength > 64)) {
    throw new AppError(400, "Minimum password length must be between 6 and 64", "PASSWORD_LENGTH_INVALID");
  }

  const data: Prisma.TenantSessionLoginPolicyUpdateInput = {};
  const assign = <K extends keyof SaveSessionLoginPolicyInput>(key: K) => {
    if (input[key] !== undefined) {
      (data as Record<string, unknown>)[key as string] = input[key];
    }
  };

  assign("sessionTimeoutMinutes");
  assign("warningBeforeLogoutMinutes");
  assign("forceLogoutOtherDevices");
  assign("rememberMeEnabled");
  assign("autoLogoutOnBrowserClose");
  assign("maxLoginAttempts");
  assign("lockoutDurationMinutes");
  assign("lockAccountAfterMaxAttempts");
  assign("notifyAdminOnLock");
  assign("captchaOnLogin");
  assign("minPasswordLength");
  assign("requireUppercase");
  assign("requireLowercase");
  assign("requireNumbers");
  assign("requireSpecialChars");
  assign("passwordExpiryDays");
  assign("preventPasswordReuseLast");
  assign("restrictToAllowedIps");
  if (input.allowedIpAddresses !== undefined) {
    data.allowedIpAddresses = input.allowedIpAddresses?.trim() || null;
  }
  if (input.blockedIpAddresses !== undefined) {
    data.blockedIpAddresses = input.blockedIpAddresses?.trim() || null;
  }

  await prisma.tenantSessionLoginPolicy.update({ where: { tenantId }, data });
  return getSessionLoginPolicySetup(tenantId);
}

export async function terminateLoginSession(tenantId: string, id: string) {
  const result = await prisma.userLoginSession.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
  return getSessionLoginPolicySetup(tenantId);
}

export async function terminateOtherLoginSessions(tenantId: string) {
  await prisma.userLoginSession.deleteMany({
    where: { tenantId, isCurrent: false },
  });
  return getSessionLoginPolicySetup(tenantId);
}
