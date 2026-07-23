import bcrypt from "bcryptjs";
import {
  DistributionModel,
  Prisma,
  ProductMode,
  TenantStatus,
  TenantType,
  UserStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { ensureTenantRoles } from "../../lib/tenant-bootstrap.js";
import { normalizeProductMode } from "../tenants/tenant.service.js";

const PASSWORD_ROUNDS = 12;

type JsonObject = Record<string, unknown>;

function asJson(value: JsonObject | null | undefined) {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : (value as Prisma.InputJsonValue);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function getPlatformStats() {
  const [tenantsByStatus, tenantsByType, tenantsByMode, tenantTotal, userTotal, resellerTotal, studentTotal, recentTenants] =
    await Promise.all([
      prisma.tenant.groupBy({ by: ["status"], _count: true }),
      prisma.tenant.groupBy({ by: ["type"], _count: true }),
      prisma.tenant.groupBy({ by: ["productMode"], _count: true }),
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.reseller.count(),
      prisma.student.count(),
      prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { reseller: { select: { name: true } }, _count: { select: { users: true, students: true } } },
      }),
    ]);

  const toMap = <T extends { _count: number }>(rows: T[], key: keyof T) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[String(row[key])] = row._count;
      return acc;
    }, {});

  return {
    totals: {
      tenants: tenantTotal,
      activeTenants: toMap(tenantsByStatus, "status").ACTIVE ?? 0,
      suspendedTenants: toMap(tenantsByStatus, "status").SUSPENDED ?? 0,
      archivedTenants: toMap(tenantsByStatus, "status").ARCHIVED ?? 0,
      users: userTotal,
      resellers: resellerTotal,
      students: studentTotal,
    },
    tenantsByStatus: toMap(tenantsByStatus, "status"),
    tenantsByType: toMap(tenantsByType, "type"),
    tenantsByProductMode: toMap(tenantsByMode, "productMode"),
    recentTenants: recentTenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      type: tenant.type,
      productMode: tenant.productMode,
      status: tenant.status,
      reseller: tenant.reseller?.name ?? null,
      users: tenant._count.users,
      students: tenant._count.students,
      createdAt: tenant.createdAt,
    })),
  };
}

export async function listTenants(query?: {
  search?: string;
  status?: TenantStatus;
  type?: TenantType;
  productMode?: ProductMode;
  resellerId?: string;
}) {
  const tenants = await prisma.tenant.findMany({
    where: {
      status: query?.status,
      type: query?.type,
      productMode: query?.productMode,
      resellerId: query?.resellerId,
      ...(query?.search
        ? {
            OR: [
              { name: { contains: query.search } },
              { slug: { contains: query.search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      reseller: { select: { id: true, name: true } },
      _count: { select: { users: true, students: true } },
    },
  });
  return tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    type: tenant.type,
    productMode: tenant.productMode,
    distributionModel: tenant.distributionModel,
    status: tenant.status,
    branding: tenant.branding,
    reseller: tenant.reseller,
    users: tenant._count.users,
    students: tenant._count.students,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  }));
}

export async function getTenantDetail(id: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      reseller: { select: { id: true, name: true, slug: true } },
      setting: true,
      _count: { select: { users: true, students: true } },
      users: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { roles: { include: { role: { select: { code: true } } } } },
      },
    },
  });
  if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

  const activity = await prisma.auditLog.findMany({
    where: { tenantId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    type: tenant.type,
    productMode: tenant.productMode,
    distributionModel: tenant.distributionModel,
    status: tenant.status,
    branding: tenant.branding,
    reseller: tenant.reseller,
    users: tenant._count.users,
    students: tenant._count.students,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    settingsSummary: tenant.setting
      ? {
          autoAdmissionNumber: tenant.setting.autoAdmissionNumber,
          attendanceType: tenant.setting.attendanceType,
          currency: tenant.setting.currency,
          examResultType: tenant.setting.examResultType,
          onlineAdmission: tenant.setting.onlineAdmission,
        }
      : null,
    recentUsers: tenant.users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles: user.roles.map(({ role }) => role.code),
    })),
    activity: activity.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      actor: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
      createdAt: log.createdAt,
    })),
  };
}

interface CreateTenantInput {
  name: string;
  slug?: string;
  type: TenantType;
  productMode: ProductMode;
  distributionModel?: DistributionModel;
  resellerId?: string | null;
  branding?: JsonObject;
  adminEmail?: string;
  adminPassword?: string;
  adminFirstName?: string;
  adminLastName?: string;
}

export async function createTenant(input: CreateTenantInput) {
  const slug = slugify(input.slug ?? input.name);
  if (!slug) throw new AppError(400, "A valid tenant slug is required", "INVALID_SLUG");
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) throw new AppError(409, "A tenant with this slug already exists", "SLUG_TAKEN");

  if (input.resellerId) {
    const reseller = await prisma.reseller.findUnique({ where: { id: input.resellerId } });
    if (!reseller) throw new AppError(400, "Reseller not found", "RESELLER_NOT_FOUND");
  }

  const productMode = normalizeProductMode(input.type, input.productMode);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name.trim(),
        slug,
        type: input.type,
        productMode,
        distributionModel: input.distributionModel ?? DistributionModel.UNIVERSE_AI,
        resellerId: input.resellerId ?? null,
        branding: asJson(input.branding),
      },
    });

    await ensureTenantRoles(tenant.id, tx);

    let admin: { email: string; temporaryPassword?: string } | null = null;
    if (input.adminEmail) {
      const email = input.adminEmail.trim().toLowerCase();
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          code: "INSTITUTION_ADMIN",
          name: "Institution Admin",
          isSystem: true,
        },
      });
      const permissions = await tx.permission.findMany({
        where: { key: { notIn: ["platform.manage", "tenants.manage"] } },
      });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
      });
      const password = input.adminPassword?.trim() || "ChangeMe123!";
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash: await bcrypt.hash(password, PASSWORD_ROUNDS),
          firstName: input.adminFirstName?.trim() || "Institution",
          lastName: input.adminLastName?.trim() || "Administrator",
        },
      });
      await tx.userRole.create({
        data: { userId: user.id, roleId: role.id, tenantId: tenant.id },
      });
      admin = { email, temporaryPassword: input.adminPassword ? undefined : password };
    }

    return { tenant, admin };
  });
}

interface UpdateTenantInput {
  name?: string;
  type?: TenantType;
  productMode?: ProductMode;
  distributionModel?: DistributionModel;
  resellerId?: string | null;
  branding?: JsonObject | null;
}

export async function updateTenant(id: string, input: UpdateTenantInput) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

  const type = input.type ?? tenant.type;
  const productMode =
    input.productMode !== undefined || input.type !== undefined
      ? normalizeProductMode(type, input.productMode ?? tenant.productMode)
      : undefined;

  if (input.resellerId) {
    const reseller = await prisma.reseller.findUnique({ where: { id: input.resellerId } });
    if (!reseller) throw new AppError(400, "Reseller not found", "RESELLER_NOT_FOUND");
  }

  return prisma.tenant.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      type: input.type,
      productMode,
      distributionModel: input.distributionModel,
      resellerId: input.resellerId === undefined ? undefined : input.resellerId,
      branding: input.branding === undefined ? undefined : asJson(input.branding),
    },
  });
}

export async function setTenantStatus(id: string, status: TenantStatus) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");
  return prisma.tenant.update({ where: { id }, data: { status } });
}

export async function listResellers() {
  const resellers = await prisma.reseller.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tenants: true, users: true } } },
  });
  return resellers.map((reseller) => ({
    id: reseller.id,
    name: reseller.name,
    slug: reseller.slug,
    branding: reseller.branding,
    tenants: reseller._count.tenants,
    users: reseller._count.users,
    createdAt: reseller.createdAt,
  }));
}

export async function createReseller(input: { name: string; slug?: string; branding?: JsonObject }) {
  const slug = slugify(input.slug ?? input.name);
  if (!slug) throw new AppError(400, "A valid reseller slug is required", "INVALID_SLUG");
  const existing = await prisma.reseller.findUnique({ where: { slug } });
  if (existing) throw new AppError(409, "A reseller with this slug already exists", "SLUG_TAKEN");
  return prisma.reseller.create({
    data: { name: input.name.trim(), slug, branding: asJson(input.branding) },
  });
}

export async function updateReseller(
  id: string,
  input: { name?: string; branding?: JsonObject | null },
) {
  const reseller = await prisma.reseller.findUnique({ where: { id } });
  if (!reseller) throw new AppError(404, "Reseller not found", "RESELLER_NOT_FOUND");
  return prisma.reseller.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      branding: input.branding === undefined ? undefined : asJson(input.branding),
    },
  });
}

export async function listPlatformUsers(query?: {
  search?: string;
  tenantId?: string;
  status?: UserStatus;
  role?: string;
}) {
  const users = await prisma.user.findMany({
    where: {
      tenantId: query?.tenantId,
      status: query?.status,
      ...(query?.search
        ? {
            OR: [
              { email: { contains: query.search } },
              { firstName: { contains: query.search } },
              { lastName: { contains: query.search } },
            ],
          }
        : {}),
      ...(query?.role
        ? { roles: { some: { role: { code: query.role } } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      reseller: { select: { id: true, name: true } },
      roles: { include: { role: { select: { code: true, name: true } } } },
    },
  });
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    tenant: user.tenant,
    reseller: user.reseller,
    roles: user.roles.map(({ role }) => role.code),
    createdAt: user.createdAt,
  }));
}

export async function setUserStatus(userId: string, status: UserStatus, requesterId: string) {
  if (userId === requesterId) {
    throw new AppError(400, "You cannot change your own status", "SELF_STATUS_CHANGE");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  return prisma.user.update({
    where: { id: userId },
    data: { status },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
    },
  });
}

export async function updatePlatformUser(
  userId: string,
  requesterId: string,
  input: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    status?: UserStatus;
    password?: string;
  },
) {
  if (userId === requesterId && input.status === UserStatus.DISABLED) {
    throw new AppError(400, "You cannot disable your own account", "SELF_STATUS_CHANGE");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

  const email = input.email?.trim().toLowerCase();
  if (email && email !== user.email) {
    const exists = await prisma.user.findFirst({
      where: {
        email,
        tenantId: user.tenantId,
        NOT: { id: userId },
      },
    });
    if (exists) throw new AppError(409, "Email already exists", "USER_EXISTS");
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone === undefined ? undefined : input.phone?.trim() || null,
      status: input.status,
      passwordHash: input.password
        ? await bcrypt.hash(input.password, PASSWORD_ROUNDS)
        : undefined,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
    },
  });
}

/** Soft-disable when user has history; hard-delete when unused. */
export async function deletePlatformUser(userId: string, requesterId: string) {
  if (userId === requesterId) {
    throw new AppError(400, "You cannot delete your own account", "SELF_DELETE");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: { select: { id: true } },
      staffProfile: { select: { id: true } },
      _count: {
        select: {
          feePaymentsCreated: true,
          attendanceMarked: true,
          homeworkCreated: true,
          auditLogs: true,
        },
      },
    },
  });
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

  const hasHistory =
    Boolean(user.studentProfile) ||
    Boolean(user.staffProfile) ||
    user._count.feePaymentsCreated > 0 ||
    user._count.attendanceMarked > 0 ||
    user._count.homeworkCreated > 0 ||
    user._count.auditLogs > 0;

  if (hasHistory) {
    const data = await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DISABLED },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
      },
    });
    return { mode: "disabled" as const, user: data };
  }

  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  return { mode: "deleted" as const, id: userId };
}

export async function getPlatformAudit(query?: {
  tenantId?: string;
  action?: string;
  actor?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: query?.tenantId,
      action: query?.action ? { contains: query.action } : undefined,
      createdAt:
        query?.from || query?.to
          ? {
              gte: query.from,
              lte: query.to,
            }
          : undefined,
      ...(query?.actor
        ? {
            user: {
              OR: [
                { firstName: { contains: query.actor } },
                { lastName: { contains: query.actor } },
                { email: { contains: query.actor } },
              ],
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(query?.limit ?? 100, 300),
    include: {
      tenant: { select: { name: true, slug: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });
  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    tenant: log.tenant?.name ?? null,
    tenantSlug: log.tenant?.slug ?? null,
    actor: log.user ? `${log.user.firstName} ${log.user.lastName}` : null,
    actorEmail: log.user?.email ?? null,
    createdAt: log.createdAt,
  }));
}

export async function getPlatformSettings() {
  const { env } = await import("../../config/env.js");
  const row = await prisma.platformSetting.findUnique({ where: { id: "platform" } });
  const branding =
    row?.branding && typeof row.branding === "object" && !Array.isArray(row.branding)
      ? (row.branding as Record<string, unknown>)
      : { primaryColor: "#4f46e5", logoText: "SaaS CMS LMS" };

  return {
    brandingDefaults: {
      primaryColor: typeof branding.primaryColor === "string" ? branding.primaryColor : "#4f46e5",
      logoText: typeof branding.logoText === "string" ? branding.logoText : "SaaS CMS LMS",
    },
    security: {
      jwtExpiresIn: env.JWT_EXPIRES_IN,
      notes: [
        "Platform users authenticate without a tenant workspace slug.",
        "Suspended tenants cannot sign in until reactivated.",
        "JWT access tokens are revalidated against live user and tenant status on every request.",
      ],
    },
    environment: {
      nodeEnv: env.NODE_ENV,
      apiPort: env.API_PORT,
      webOrigin: env.WEB_ORIGIN,
      version: "0.1.0",
    },
  };
}

export async function updatePlatformSettings(input: { branding?: JsonObject }) {
  const existing = await getPlatformSettings();
  const branding = {
    ...existing.brandingDefaults,
    ...(input.branding ?? {}),
  };
  await prisma.platformSetting.upsert({
    where: { id: "platform" },
    update: { branding: asJson(branding) },
    create: { id: "platform", branding: asJson(branding) },
  });
  return getPlatformSettings();
}

export async function getResellerDetail(id: string) {
  const reseller = await prisma.reseller.findUnique({
    where: { id },
    include: {
      tenants: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          productMode: true,
          status: true,
        },
      },
      _count: { select: { tenants: true, users: true } },
    },
  });
  if (!reseller) throw new AppError(404, "Reseller not found", "RESELLER_NOT_FOUND");
  return {
    id: reseller.id,
    name: reseller.name,
    slug: reseller.slug,
    branding: reseller.branding,
    tenants: reseller.tenants,
    tenantCount: reseller._count.tenants,
    userCount: reseller._count.users,
    createdAt: reseller.createdAt,
  };
}

export async function assignTenantsToReseller(resellerId: string, tenantIds: string[]) {
  const reseller = await prisma.reseller.findUnique({ where: { id: resellerId } });
  if (!reseller) throw new AppError(404, "Reseller not found", "RESELLER_NOT_FOUND");
  const uniqueIds = [...new Set(tenantIds)];
  const count = await prisma.tenant.count({ where: { id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) {
    throw new AppError(400, "One or more tenants are invalid", "INVALID_TENANTS");
  }
  await prisma.$transaction([
    prisma.tenant.updateMany({
      where: { resellerId, id: { notIn: uniqueIds } },
      data: { resellerId: null },
    }),
    prisma.tenant.updateMany({
      where: { id: { in: uniqueIds } },
      data: { resellerId },
    }),
  ]);
  return getResellerDetail(resellerId);
}
