import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AuthVerificationPurpose, TenantStatus, UserStatus, type Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
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
import { prisma } from "../../lib/prisma.js";
import type { AuthContext } from "../../types/express.js";

interface LoginInput {
  email: string;
  password: string;
  tenantSlug?: string;
}

interface TenantScopedInput {
  email: string;
  tenantSlug?: string;
}

interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  tenantId: string | null;
  resellerId: string | null;
}

const userInclude = {
  tenant: true,
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type LoadedUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

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

  const user = await prisma.user.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      status: UserStatus.ACTIVE,
      ...(tenant ? { tenantId: tenant.id } : { tenantId: null }),
    },
    include: userInclude,
  });

  if (!user || (user.tenant && user.tenant.status !== TenantStatus.ACTIVE)) {
    return null;
  }
  return user;
}

function assertUserCanSignIn(user: LoadedUser) {
  if (user.tenant && user.tenant.status !== TenantStatus.ACTIVE) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }
}

export async function buildLoginResult(user: LoadedUser) {
  assertUserCanSignIn(user);

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

  if (user.tenantId) {
    await prisma.auditLog
      .create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: "LOGIN",
          entityType: "USER_SESSION",
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
  return buildLoginResult(user);
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

  return buildLoginResult(user);
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
  const resetUrl = `${env.WEB_ORIGIN}/reset-password?${params.toString()}`;

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

export async function loginWithGoogle(input: { idToken: string; tenantSlug?: string }) {
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
    include: userInclude,
  });

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        email: profile.email,
        status: UserStatus.ACTIVE,
        ...(tenant ? { tenantId: tenant.id } : { tenantId: null }),
      },
      include: userInclude,
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleSubjectId: profile.googleSubjectId },
        include: userInclude,
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

  return buildLoginResult(user);
}

export function getAuthPublicConfig() {
  return {
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    mailConfigured: isMailConfigured(),
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

  const user = await prisma.user.findFirst({
    where: {
      id: payload.sub,
      tenantId: payload.tenantId,
      resellerId: payload.resellerId,
      status: UserStatus.ACTIVE,
    },
    include: {
      tenant: true,
      roles: {
        where: { tenantId: payload.tenantId },
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (
    !user ||
    (user.tenant && user.tenant.status !== TenantStatus.ACTIVE) ||
    user.tenantId !== payload.tenantId
  ) {
    throw new AppError(401, "Access is no longer valid", "INVALID_TOKEN");
  }

  return {
    userId: user.id,
    tenantId: user.tenantId,
    resellerId: user.resellerId,
    tenantType: user.tenant?.type ?? null,
    productMode: user.tenant?.productMode ?? null,
    roles: user.roles.map(({ role }) => role.code),
    permissions: [
      ...new Set(
        user.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ],
  };
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
