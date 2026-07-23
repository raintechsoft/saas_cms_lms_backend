import bcrypt from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { ensureTenantRoles } from "../../lib/tenant-bootstrap.js";
import { tenantScope } from "../../lib/tenant-scope.js";

interface RoleInput {
  name: string;
  code: string;
  description?: string | null;
  permissionIds: string[];
}

interface UserInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string | null;
  roleIds: string[];
}

interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  phone?: string | null;
  status?: UserStatus;
  roleIds?: string[];
}

const roleInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

const userInclude = {
  roles: { include: { role: true } },
} as const;

async function assertPermissions(permissionIds: string[]) {
  const count = await prisma.permission.count({ where: { id: { in: permissionIds } } });
  if (count !== new Set(permissionIds).size) {
    throw new AppError(400, "One or more permissions are invalid", "INVALID_PERMISSION");
  }
}

async function assertTenantRoles(tenantId: string, roleIds: string[]) {
  const count = await prisma.role.count({
    where: tenantScope(tenantId, { id: { in: roleIds } }),
  });
  if (count !== new Set(roleIds).size) {
    throw new AppError(400, "One or more roles are invalid for this tenant", "INVALID_ROLE");
  }
}

export function listPermissions() {
  return prisma.permission.findMany({ orderBy: { key: "asc" } });
}

export async function listRoles(tenantId: string) {
  await ensureTenantRoles(tenantId);
  return prisma.role.findMany({
    where: tenantScope(tenantId, {}),
    include: roleInclude,
    orderBy: { name: "asc" },
  });
}

export async function createRole(tenantId: string, input: RoleInput) {
  await assertPermissions(input.permissionIds);
  const exists = await prisma.role.findFirst({
    where: tenantScope(tenantId, { code: input.code }),
  });
  if (exists) throw new AppError(409, "Role code already exists", "ROLE_EXISTS");

  return prisma.role.create({
    data: {
      tenantId,
      code: input.code,
      name: input.name,
      description: input.description,
      permissions: {
        create: [...new Set(input.permissionIds)].map((permissionId) => ({ permissionId })),
      },
    },
    include: roleInclude,
  });
}

export async function updateRole(
  tenantId: string,
  roleId: string,
  input: Omit<RoleInput, "code">,
) {
  await assertPermissions(input.permissionIds);
  const role = await prisma.role.findFirst({
    where: tenantScope(tenantId, { id: roleId }),
  });
  if (!role) throw new AppError(404, "Role not found", "ROLE_NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    return tx.role.update({
      where: { id: roleId },
      data: {
        name: input.name,
        description: input.description,
        permissions: {
          create: [...new Set(input.permissionIds)].map((permissionId) => ({ permissionId })),
        },
      },
      include: roleInclude,
    });
  });
}

export async function deleteRole(tenantId: string, roleId: string) {
  const role = await prisma.role.findFirst({
    where: tenantScope(tenantId, { id: roleId }),
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new AppError(404, "Role not found", "ROLE_NOT_FOUND");
  if (role.isSystem) throw new AppError(409, "System roles cannot be deleted", "SYSTEM_ROLE");
  if (role._count.users) {
    throw new AppError(409, "Remove users from this role first", "ROLE_IN_USE");
  }
  await prisma.role.delete({ where: { id: roleId } });
}

export function listUsers(tenantId: string) {
  return prisma.user.findMany({
    where: tenantScope(tenantId, {}),
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      roles: userInclude.roles,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export async function getUser(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: tenantScope(tenantId, { id: userId }),
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      roles: userInclude.roles,
      studentProfile: { select: { id: true } },
      staffProfile: { select: { id: true } },
    },
  });
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  return user;
}

export async function createUser(tenantId: string, input: UserInput) {
  const email = input.email.trim().toLowerCase();
  await assertTenantRoles(tenantId, input.roleIds);
  const exists = await prisma.user.findFirst({ where: tenantScope(tenantId, { email }) });
  if (exists) throw new AppError(409, "Email already exists", "USER_EXISTS");

  return prisma.user.create({
    data: {
      tenantId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone?.trim() || null,
      passwordHash: await bcrypt.hash(input.password, 12),
      roles: {
        create: [...new Set(input.roleIds)].map((roleId) => ({ roleId, tenantId })),
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      roles: userInclude.roles,
    },
  });
}

export async function updateUser(
  tenantId: string,
  actorUserId: string,
  userId: string,
  input: UpdateUserInput,
) {
  const user = await prisma.user.findFirst({
    where: tenantScope(tenantId, { id: userId }),
  });
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  if (userId === actorUserId && input.status === UserStatus.DISABLED) {
    throw new AppError(409, "You cannot disable your own account", "SELF_DISABLE");
  }
  if (input.roleIds) await assertTenantRoles(tenantId, input.roleIds);

  const email = input.email?.trim().toLowerCase();
  if (email && email !== user.email) {
    const exists = await prisma.user.findFirst({ where: tenantScope(tenantId, { email }) });
    if (exists) throw new AppError(409, "Email already exists", "USER_EXISTS");
  }

  return prisma.$transaction(async (tx) => {
    if (input.roleIds) {
      await tx.userRole.deleteMany({ where: { userId, tenantId } });
    }
    return tx.user.update({
      where: { id: userId },
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone === undefined ? undefined : input.phone?.trim() || null,
        status: input.status,
        passwordHash: input.password ? await bcrypt.hash(input.password, 12) : undefined,
        roles: input.roleIds
          ? {
              create: [...new Set(input.roleIds)].map((roleId) => ({ roleId, tenantId })),
            }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        roles: userInclude.roles,
      },
    });
  });
}

/** Soft-delete: disable the account. Hard delete only when the user has no linked profiles/history. */
export async function deleteUser(tenantId: string, actorUserId: string, userId: string) {
  if (userId === actorUserId) {
    throw new AppError(409, "You cannot delete your own account", "SELF_DELETE");
  }

  const user = await prisma.user.findFirst({
    where: tenantScope(tenantId, { id: userId }),
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
        roles: userInclude.roles,
      },
    });
    return { mode: "disabled" as const, user: data };
  }

  await prisma.userRole.deleteMany({ where: { userId, tenantId } });
  await prisma.user.delete({ where: { id: userId } });
  return { mode: "deleted" as const, id: userId };
}
