import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import {
  AuthVerificationPurpose,
  StudentStatus,
  TenantStatus,
  UserStatus,
  type Prisma,
} from "@prisma/client";
import { env, isMsg91OtpWidgetConfigured } from "../../config/env.js";
import {
  AUTH_CODE_TTL,
  consumeAuthVerification,
  createAuthVerification,
  generateOtpCode,
  generateResetToken,
} from "../../lib/auth-codes.js";
import { AppError } from "../../lib/errors.js";
import { verifyGoogleIdToken, isGoogleAuthConfigured } from "../../lib/google-auth.js";
import {
  isMailConfigured,
  otpEmailHtml,
  resetPasswordEmailHtml,
  sendMail,
} from "../../lib/mail.js";
import { isSmsConfigured, normalizeSmsNumber, sendSms, toMsg91Mobile } from "../../lib/sms.js";
import {
  authCacheKey,
  getCachedAuthContext,
  setCachedAuthContext,
} from "../../lib/auth-cache.js";
import { prisma } from "../../lib/prisma.js";
import type { AuthContext } from "../../types/express.js";

interface LoginInput {
  email: string;
  password: string;
  tenantSlug?: string;
  channel?: "WEB" | "APP";
}

interface TenantScopedInput {
  email: string;
  tenantSlug?: string;
  channel?: "WEB" | "APP";
}

interface PhoneScopedInput {
  phone: string;
  tenantSlug?: string;
  channel?: "WEB" | "APP";
}

interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  tenantId: string | null;
  resellerId: string | null;
}

const userTenantInclude = {
  tenant: true,
} satisfies Prisma.UserInclude;

const roleWithPermissionsInclude = {
  permissions: { include: { permission: true } },
} satisfies Prisma.RoleInclude;

type LoadedUser = Prisma.UserGetPayload<{ include: typeof userTenantInclude }> & {
  roles: Array<
    Prisma.UserRoleGetPayload<{ include: { role: { include: typeof roleWithPermissionsInclude } } }>
  >;
};

async function attachRoles(
  user: Prisma.UserGetPayload<{ include: typeof userTenantInclude }>,
): Promise<LoadedUser> {
  const links = await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { userId: true, roleId: true, tenantId: true },
  });
  const roleIds = [...new Set(links.map((link) => link.roleId))];
  const roles = roleIds.length
    ? await prisma.role.findMany({
        where: { id: { in: roleIds } },
        include: roleWithPermissionsInclude,
      })
    : [];
  const byId = new Map(roles.map((role) => [role.id, role]));

  return {
    ...user,
    roles: links.flatMap((link) => {
      const role = byId.get(link.roleId);
      if (!role) {
        console.warn(`[auth] Skipping missing role ${link.roleId} for user ${link.userId}`);
        return [];
      }
      return [{ userId: link.userId, roleId: link.roleId, tenantId: link.tenantId, role }];
    }),
  };
}

function getModuleSettings(tenantId: string | null) {
  return tenantId
    ? prisma.tenantModuleSetting.findMany({
        where: { tenantId },
        select: {
          moduleKey: true,
          adminEnabled: true,
          studentEnabled: true,
          parentEnabled: true,
        },
      })
    : Promise.resolve([]);
}

async function resolveTenant(slug?: string) {
  if (!slug) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: slug.trim().toLowerCase() },
  });
  if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }
  return tenant;
}

async function findActiveUser(email: string, tenantSlug?: string) {
  const tenant = await resolveTenant(tenantSlug);
  if (tenantSlug && !tenant) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const normalizedEmail = email.trim().toLowerCase();

  let user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      status: UserStatus.ACTIVE,
      ...(tenant ? { tenantId: tenant.id } : { tenantId: null }),
    },
    include: userTenantInclude,
  });

  if (!user) {
    const student = await prisma.student.findFirst({
      where: {
        status: StudentStatus.ACTIVE,
        ...(tenant ? { tenantId: tenant.id } : {}),
        userId: { not: null },
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
      select: { userId: true },
    });

    if (student?.userId) {
      user = await prisma.user.findFirst({
        where: {
          id: student.userId,
          status: UserStatus.ACTIVE,
          ...(tenant ? { tenantId: tenant.id } : {}),
        },
        include: userTenantInclude,
      });
    }
  }

  if (!user || (user.tenant && user.tenant.status !== TenantStatus.ACTIVE)) {
    return null;
  }
  return attachRoles(user);
}

function assertUserCanSignIn(user: LoadedUser) {
  if (user.tenant && user.tenant.status !== TenantStatus.ACTIVE) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }
}

export async function buildLoginResult(
  user: LoadedUser,
  options?: { channel?: "WEB" | "APP" },
) {
  assertUserCanSignIn(user);

  const roleCodes = user.roles.map(({ role }) => role.code);
  if (user.tenantId && roleCodes.includes("STUDENT")) {
    const { assertStudentLoginAllowed } = await import(
      "../erp/student-access-settings.service.js"
    );
    await assertStudentLoginAllowed(user.tenantId);
  }

  const accessToken = jwt.sign(
    {
      tenantId: user.tenantId,
      resellerId: user.resellerId,
    },
    env.JWT_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
      issuer: "saas-cms-lms-api",
      audience: "saas-cms-lms-web",
    },
  );

  const now = new Date();
  const channel = options?.channel === "APP" ? "APP" : "WEB";
  await prisma.user
    .update({
      where: { id: user.id },
      data: {
        firstLoginAt: user.firstLoginAt ?? now,
        lastLoginAt: now,
        lastLoginChannel: channel,
      },
    })
    .catch((error: unknown) => {
      console.error("Unable to record portal login timestamps", error);
    });

  if (user.tenantId) {
    await prisma.auditLog
      .create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: "LOGIN",
          entityType: "USER_SESSION",
          metadata: { channel },
        },
      })
      .catch((error: unknown) => {
        console.error("Unable to record login audit event", error);
      });
  }

  const moduleSettings = await getModuleSettings(user.tenantId);

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            type: user.tenant.type,
            productMode: user.tenant.productMode,
            branding: user.tenant.branding,
          }
        : null,
      roles: user.roles.map(({ role }) => role.code),
      permissions: [
        ...new Set(
          user.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.key),
          ),
        ),
      ],
      moduleSettings,
    },
  };
}

export async function login(input: LoginInput) {
  const user = await findActiveUser(input.email, input.tenantSlug);
  if (
    !user ||
    !user.passwordHash ||
    !(await bcrypt.compare(input.password, user.passwordHash))
  ) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }
  return buildLoginResult(user, { channel: input.channel });
}

export async function requestLoginOtp(input: TenantScopedInput) {
  const user = await findActiveUser(input.email, input.tenantSlug);
  const genericMessage = "If the account exists, a sign-in code was sent to your email.";

  if (!user) {
    return { message: genericMessage };
  }

  const code = generateOtpCode();
  await createAuthVerification({
    userId: user.id,
    purpose: AuthVerificationPurpose.LOGIN_OTP,
    code,
    ttlMs: AUTH_CODE_TTL.OTP,
  });

  const workspaceName = user.tenant?.name ?? "SaaS CMS LMS";
  const text = [
    `Hello ${user.firstName},`,
    "",
    `Your one-time sign-in code for ${workspaceName} is: ${code}`,
    "",
    "This code expires in 10 minutes. If you did not request it, you can ignore this email.",
    "",
    "SaaS CMS LMS",
  ].join("\n");

  await sendMail({
    to: user.email,
    subject: `${code} is your ${workspaceName} sign-in code`,
    text,
    html: otpEmailHtml({ firstName: user.firstName, code, workspaceName }),
  });

  const response: { message: string; devCode?: string } = { message: genericMessage };
  if (env.NODE_ENV === "development" && !isMailConfigured()) {
    response.devCode = code;
  }
  return response;
}

export async function verifyLoginOtp(input: TenantScopedInput & { code: string }) {
  const user = await findActiveUser(input.email, input.tenantSlug);
  if (!user) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const verified = await consumeAuthVerification({
    userId: user.id,
    purpose: AuthVerificationPurpose.LOGIN_OTP,
    code: input.code.trim(),
  });
  if (!verified) {
    throw new AppError(401, "Invalid or expired sign-in code", "INVALID_OTP");
  }

  return buildLoginResult(user, { channel: input.channel });
}

export async function requestPhoneLoginOtp(input: PhoneScopedInput) {
  const user = await findActiveUserByPhoneOrEmail(input.phone, input.tenantSlug);
  const genericMessage =
    "If the account exists, a sign-in code was sent to your mobile.";

  if (!user) {
    return { message: genericMessage };
  }

  const code = generateOtpCode();
  await createAuthVerification({
    userId: user.id,
    purpose: AuthVerificationPurpose.LOGIN_OTP,
    code,
    ttlMs: AUTH_CODE_TTL.OTP,
  });

  const workspaceName = user.tenant?.name ?? "SaaS CMS LMS";
  const smsBody = `${code} is your ${workspaceName} sign-in code. Valid for 10 minutes.`;

  let smsDelivered = false;
  if (user.tenantId) {
    try {
      const result = await sendSms({
        tenantId: user.tenantId,
        to: input.phone,
        body: smsBody,
        category: "OTP",
      });
      smsDelivered = result.delivered === true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[auth] Phone OTP SMS failed for ${input.phone}: ${message}`);
    }
  }

  const response: { message: string; devCode?: string } = { message: genericMessage };
  if (env.NODE_ENV === "development" || !smsDelivered || !isSmsConfigured()) {
    response.devCode = code;
    console.info(`[auth] Phone OTP for ${input.phone}: ${code}`);
  }
  return response;
}

export async function verifyPhoneLoginOtp(input: PhoneScopedInput & { code: string }) {
  const user = await findActiveUserByPhoneOrEmail(input.phone, input.tenantSlug);
  if (!user) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const verified = await consumeAuthVerification({
    userId: user.id,
    purpose: AuthVerificationPurpose.LOGIN_OTP,
    code: input.code.trim(),
  });
  if (!verified) {
    throw new AppError(401, "Invalid or expired sign-in code", "INVALID_OTP");
  }

  return buildLoginResult(user, { channel: input.channel });
}

async function verifyMsg91WidgetAccessToken(accessToken: string) {
  if (!env.MSG91_AUTH_KEY) {
    throw new AppError(503, "MSG91 OTP is not configured", "MSG91_OTP_NOT_CONFIGURED");
  }

  const response = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: env.MSG91_AUTH_KEY,
    },
    body: JSON.stringify({
      authkey: env.MSG91_AUTH_KEY,
      "access-token": accessToken,
    }),
  });

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    console.error(`[auth] MSG91 verifyAccessToken failed: ${text}`);
    throw new AppError(401, "MSG91 OTP verification failed", "MSG91_OTP_INVALID");
  }

  const type = String(payload.type ?? payload.status ?? "").toLowerCase();
  if (type && type !== "success" && type !== "ok") {
    console.error(`[auth] MSG91 verifyAccessToken rejected: ${text}`);
    throw new AppError(401, "MSG91 OTP verification failed", "MSG91_OTP_INVALID");
  }

  const message = payload.message;
  const data = payload.data;
  let identifier = "";
  if (typeof message === "string") identifier = message.trim();
  else if (message && typeof message === "object") {
    const record = message as Record<string, unknown>;
    identifier = String(record.mobile ?? record.phone ?? record.email ?? record.identifier ?? "").trim();
  }
  if (!identifier && data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    identifier = String(record.mobile ?? record.phone ?? record.email ?? record.identifier ?? "").trim();
  }
  if (!identifier) {
    throw new AppError(401, "MSG91 did not return a verified identity", "MSG91_OTP_INVALID");
  }

  return identifier;
}

async function findActiveUserByPhoneOrEmail(identifier: string, tenantSlug?: string) {
  const tenant = await resolveTenant(tenantSlug);
  if (tenantSlug && !tenant) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const looksEmail = identifier.includes("@");
  if (looksEmail) {
    return findActiveUser(identifier, tenantSlug);
  }

  const mobile = toMsg91Mobile(identifier);
  const e164 = normalizeSmsNumber(identifier);
  const last10 = mobile.replace(/\D/g, "").slice(-10);
  const phoneVariants = [...new Set([identifier, mobile, e164, `+${mobile}`, last10, `91${last10}`, `+91${last10}`].filter(Boolean))];

  let user = await prisma.user.findFirst({
    where: {
      status: UserStatus.ACTIVE,
      ...(tenant ? { tenantId: tenant.id } : { tenantId: null }),
      OR: [
        ...phoneVariants.map((phone) => ({ phone })),
        ...(last10.length === 10
          ? [{ phone: { endsWith: last10 } }, { phone: { contains: last10 } }]
          : []),
      ],
    },
    include: userTenantInclude,
  });

  if (!user && last10.length === 10) {
    const student = await prisma.student.findFirst({
      where: {
        status: StudentStatus.ACTIVE,
        ...(tenant ? { tenantId: tenant.id } : {}),
        userId: { not: null },
        OR: [
          ...phoneVariants.map((mobile) => ({ mobile })),
          { mobile: { endsWith: last10 } },
          { mobile: { contains: last10 } },
        ],
      },
      select: { userId: true },
    });

    if (student?.userId) {
      user = await prisma.user.findFirst({
        where: {
          id: student.userId,
          status: UserStatus.ACTIVE,
          ...(tenant ? { tenantId: tenant.id } : {}),
        },
        include: userTenantInclude,
      });
    }
  }

  if (!user || (user.tenant && user.tenant.status !== TenantStatus.ACTIVE)) {
    return null;
  }
  return attachRoles(user);
}

export async function loginWithMsg91Otp(input: {
  accessToken: string;
  tenantSlug?: string;
  channel?: "WEB" | "APP";
}) {
  if (!isMsg91OtpWidgetConfigured()) {
    throw new AppError(503, "MSG91 OTP widget is not configured", "MSG91_OTP_NOT_CONFIGURED");
  }

  const identifier = await verifyMsg91WidgetAccessToken(input.accessToken.trim());
  const user = await findActiveUserByPhoneOrEmail(identifier, input.tenantSlug);
  if (!user) {
    throw new AppError(
      401,
      "No account is linked to this verified mobile/email for the selected workspace",
      "MSG91_ACCOUNT_NOT_FOUND",
    );
  }

  return buildLoginResult(user, { channel: input.channel });
}

export async function forgotPassword(input: TenantScopedInput) {
  const user = await findActiveUser(input.email, input.tenantSlug);
  const genericMessage = "If the account exists, password reset instructions were sent to your email.";

  if (!user) {
    return { message: genericMessage };
  }

  const token = generateResetToken();
  await createAuthVerification({
    userId: user.id,
    purpose: AuthVerificationPurpose.PASSWORD_RESET,
    code: token,
    ttlMs: AUTH_CODE_TTL.RESET,
  });

  const params = new URLSearchParams({
    token,
    email: user.email,
  });
  if (input.tenantSlug) {
    params.set("tenant", input.tenantSlug.trim().toLowerCase());
  }
  // Frontend uses HashRouter (Electron + Vite), so deep links must include `#/`.
  const resetUrl = `${env.WEB_ORIGIN.replace(/\/$/, "")}/#/reset-password?${params.toString()}`;

  const workspaceName = user.tenant?.name ?? "SaaS CMS LMS";
  const text = [
    `Hello ${user.firstName},`,
    "",
    `We received a request to reset your password for ${workspaceName}.`,
    `Open this link to choose a new password: ${resetUrl}`,
    "",
    "This link expires in 1 hour. If you did not request a reset, you can ignore this email.",
    "",
    "SaaS CMS LMS",
  ].join("\n");

  await sendMail({
    to: user.email,
    subject: `Reset your ${workspaceName} password`,
    text,
    html: resetPasswordEmailHtml({ firstName: user.firstName, resetUrl, workspaceName }),
  });

  const response: { message: string; devResetUrl?: string } = { message: genericMessage };
  if (env.NODE_ENV === "development" && !isMailConfigured()) {
    response.devResetUrl = resetUrl;
  }
  return response;
}

export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
  tenantSlug?: string;
}) {
  const user = await findActiveUser(input.email, input.tenantSlug);
  if (!user) {
    throw new AppError(400, "Invalid or expired reset link", "INVALID_RESET_TOKEN");
  }

  const verified = await consumeAuthVerification({
    userId: user.id,
    purpose: AuthVerificationPurpose.PASSWORD_RESET,
    code: input.token.trim(),
  });
  if (!verified) {
    throw new AppError(400, "Invalid or expired reset link", "INVALID_RESET_TOKEN");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(input.password, 12) },
  });

  return { message: "Password updated. You can sign in with your new password." };
}

export async function changePassword(
  userId: string,
  input: { currentPassword?: string; newPassword: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  if (user.passwordHash) {
    if (
      !input.currentPassword ||
      !(await bcrypt.compare(input.currentPassword, user.passwordHash))
    ) {
      throw new AppError(400, "Current password is incorrect", "INVALID_CURRENT_PASSWORD");
    }
    if (input.currentPassword === input.newPassword) {
      throw new AppError(
        400,
        "New password must be different from the current password",
        "SAME_PASSWORD",
      );
    }
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
  });
  return { message: "Password updated successfully" };
}

export async function loginWithGoogle(input: {
  idToken: string;
  tenantSlug?: string;
  channel?: "WEB" | "APP";
}) {
  if (!isGoogleAuthConfigured()) {
    throw new AppError(503, "Google sign-in is not configured", "GOOGLE_NOT_CONFIGURED");
  }

  const profile = await verifyGoogleIdToken(input.idToken);
  if (!profile.emailVerified) {
    throw new AppError(401, "Google account email is not verified", "INVALID_GOOGLE_TOKEN");
  }

  const tenant = await resolveTenant(input.tenantSlug);
  if (input.tenantSlug && !tenant) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  let user = await prisma.user.findFirst({
    where: {
      googleSubjectId: profile.googleSubjectId,
      status: UserStatus.ACTIVE,
      ...(tenant ? { tenantId: tenant.id } : { tenantId: null }),
    },
    include: userTenantInclude,
  });

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        email: profile.email,
        status: UserStatus.ACTIVE,
        ...(tenant ? { tenantId: tenant.id } : { tenantId: null }),
      },
      include: userTenantInclude,
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleSubjectId: profile.googleSubjectId },
        include: userTenantInclude,
      });
    }
  }

  if (!user) {
    throw new AppError(
      401,
      "No SaaS CMS LMS account is linked to this Google email for the selected workspace",
      "GOOGLE_ACCOUNT_NOT_FOUND",
    );
  }

  return buildLoginResult(await attachRoles(user), { channel: input.channel });
}

export function getAuthPublicConfig() {
  return {
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    mailConfigured: isMailConfigured(),
    msg91Otp:
      isMsg91OtpWidgetConfigured()
        ? {
            widgetId: env.MSG91_WIDGET_ID!,
            tokenAuth: env.MSG91_TOKEN_AUTH!,
          }
        : null,
  };
}

export async function resolveAuthContext(token: string): Promise<AuthContext> {
  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: "saas-cms-lms-api",
      audience: "saas-cms-lms-web",
    }) as AccessTokenPayload;
  } catch {
    throw new AppError(401, "Invalid or expired access token", "INVALID_TOKEN");
  }

  if (!payload.sub) {
    throw new AppError(401, "Invalid access token", "INVALID_TOKEN");
  }

  const cacheKey = authCacheKey(payload.sub, payload.tenantId, payload.resellerId);
  const cached = getCachedAuthContext(cacheKey);
  if (cached) {
    return cached;
  }

  const found = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      tenantId: payload.tenantId,
      resellerId: payload.resellerId,
      status: UserStatus.ACTIVE,
    },
    include: userTenantInclude,
  });

  if (
    !found ||
    (found.tenant && found.tenant.status !== TenantStatus.ACTIVE) ||
    found.tenantId !== payload.tenantId
  ) {
    throw new AppError(401, "Access is no longer valid", "INVALID_TOKEN");
  }

  const user = await attachRoles(found);
  const scopedRoles = user.roles.filter((link) => link.tenantId === payload.tenantId);

  const auth: AuthContext = {
    userId: user.id,
    tenantId: user.tenantId,
    resellerId: user.resellerId,
    tenantType: user.tenant?.type ?? null,
    productMode: user.tenant?.productMode ?? null,
    roles: scopedRoles.map(({ role }) => role.code),
    permissions: [
      ...new Set(
        scopedRoles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ],
  };

  setCachedAuthContext(cacheKey, user.id, auth);
  return auth;
}

export async function getCurrentUser(token: string) {
  const auth = await resolveAuthContext(token);
  const user = await prisma.user.findFirst({
    where: {
      id: auth.userId,
      tenantId: auth.tenantId,
      status: UserStatus.ACTIVE,
    },
    include: { tenant: true },
  });

  if (!user) {
    throw new AppError(401, "Access is no longer valid", "INVALID_TOKEN");
  }
  const moduleSettings = await getModuleSettings(user.tenantId);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    tenant: user.tenant
      ? {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          type: user.tenant.type,
          productMode: user.tenant.productMode,
          branding: user.tenant.branding,
        }
      : null,
    roles: auth.roles,
    permissions: auth.permissions,
    moduleSettings,
  };
}

export async function updateOwnProfile(
  userId: string,
  input: { firstName?: string; lastName?: string; phone?: string | null },
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
    },
    include: { tenant: true },
  });

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
  };
}

export async function updateOwnAvatar(userId: string, avatarUrl: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
    },
  });
  return user;
}

const PORTAL_SELF_DELETE_ROLES = new Set(["STUDENT", "PARENT"]);

export async function deleteOwnAccount(userId: string, input: { password: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(400, "Account is already inactive", "ACCOUNT_INACTIVE");
  }

  const links = await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  });
  const roles = links.length
    ? await prisma.role.findMany({
        where: { id: { in: links.map((link) => link.roleId) } },
        select: { code: true },
      })
    : [];
  const roleCodes = roles.map((role) => role.code);
  const isPortalUser =
    roleCodes.length > 0 && roleCodes.every((code) => PORTAL_SELF_DELETE_ROLES.has(code));
  if (!isPortalUser) {
    throw new AppError(
      403,
      "This account cannot be deleted from the mobile app",
      "DELETE_NOT_ALLOWED",
    );
  }

  if (!user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(400, "Password is incorrect", "INVALID_PASSWORD");
  }

  await prisma.$transaction([
    prisma.mobilePushToken.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DISABLED },
    }),
  ]);

  return {
    message:
      "Your account has been deactivated. Contact your school office if you need access restored.",
  };
}
