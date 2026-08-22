import bcrypt from "bcryptjs";
import { UserStatus } from "@prisma/client";
import {
  invalidateAuthCacheForTenant,
  invalidateAuthCacheForUser,
} from "../../lib/auth-cache.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { normalizeSmsNumber } from "../../lib/sms.js";
import { ensureTenantRoles } from "../../lib/tenant-bootstrap.js";
import { tenantScope } from "../../lib/tenant-scope.js";

interface RoleInput {
  name: string;
  code: string;
  description?: string | null;
  permissionIds: string[];
  isActive?: boolean;
}

/** Modules shown in the ERP Staff Roles permission matrix. */
export const ROLE_PERMISSION_MODULES = [
  { key: "dashboard", label: "Dashboard", view: "reports.view", manage: null, extras: [] as string[] },
  { key: "students", label: "Student Management", view: "students.view", manage: "students.manage", extras: [] },
  { key: "fees", label: "Fees", view: "fees.view", manage: "fees.manage", extras: ["fees.collect"] },
  { key: "academics", label: "Academics", view: "academics.view", manage: "academics.manage", extras: [] },
  { key: "attendance", label: "Attendance", view: "attendance.view", manage: "attendance.manage", extras: [] },
  { key: "exams", label: "Exams", view: "exams.view", manage: "exams.manage", extras: ["exams.publish"] },
  { key: "timetable", label: "Timetable", view: "timetable.view", manage: "timetable.manage", extras: [] },
  { key: "homework", label: "Homework", view: "homework.view", manage: "homework.manage", extras: ["homework.submit", "homework.evaluate"] },
  { key: "hr", label: "HR & Payroll", view: "hr.view", manage: "hr.manage", extras: ["payroll.manage"] },
  { key: "documents", label: "Documents", view: "documents.view", manage: "documents.manage", extras: ["documents.generate"] },
  { key: "transport", label: "Transport", view: "transport.view", manage: "transport.manage", extras: [] },
  { key: "hostel", label: "Hostel", view: "hostel.view", manage: "hostel.manage", extras: [] },
  { key: "library", label: "Library", view: "library.view", manage: "library.manage", extras: [] },
  { key: "inventory", label: "Inventory", view: "inventory.view", manage: "inventory.manage", extras: [] },
  { key: "online_exam", label: "Online Exam", view: "online_exam.view", manage: "online_exam.manage", extras: [] },
  { key: "erp", label: "ERP Settings", view: "erp.view", manage: "erp.manage", extras: ["erp.backup"] },
  { key: "settings", label: "Settings", view: "settings.view", manage: "settings.manage", extras: [] },
  { key: "users", label: "Users", view: "users.view", manage: "users.manage", extras: [] },
  { key: "roles", label: "Roles", view: "roles.view", manage: "roles.manage", extras: [] },
  { key: "notifications", label: "Notifications", view: null, manage: "notifications.manage", extras: [] },
  { key: "reports", label: "Reports", view: "reports.view", manage: null, extras: [] },
] as const;

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
      isActive: input.isActive ?? true,
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
  input: Partial<Omit<RoleInput, "code">> & { permissionIds?: string[] },
) {
  if (input.permissionIds) await assertPermissions(input.permissionIds);
  const role = await prisma.role.findFirst({
    where: tenantScope(tenantId, { id: roleId }),
  });
  if (!role) throw new AppError(404, "Role not found", "ROLE_NOT_FOUND");

  const updated = await prisma.$transaction(async (tx) => {
    if (input.permissionIds) {
      await tx.rolePermission.deleteMany({ where: { roleId } });
    }
    return tx.role.update({
      where: { id: roleId },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        isActive: input.isActive,
        permissions: input.permissionIds
          ? {
              create: [...new Set(input.permissionIds)].map((permissionId) => ({
                permissionId,
              })),
            }
          : undefined,
      },
      include: roleInclude,
    });
  });

  invalidateAuthCacheForTenant(tenantId);
  return updated;
}

export async function getStaffRolesSetup(tenantId: string) {
  await ensureTenantRoles(tenantId);
  const [roles, permissions, staffUsers, totalStaff] = await Promise.all([
    prisma.role.findMany({
      where: tenantScope(tenantId, {}),
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
        users: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                staffProfile: {
                  select: {
                    employeeNumber: true,
                    status: true,
                    department: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }),
    prisma.permission.findMany({
      where: { key: { not: { startsWith: "platform." } } },
      orderBy: { key: "asc" },
    }),
    prisma.user.findMany({
      where: tenantScope(tenantId, {
        OR: [{ staffProfile: { isNot: null } }, { roles: { some: {} } }],
        studentProfile: null,
      }),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        staffProfile: {
          select: {
            employeeNumber: true,
            status: true,
            department: { select: { id: true, name: true } },
          },
        },
        roles: { select: { roleId: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.staffProfile.count({ where: { tenantId } }),
  ]);

  const mappedRoles = roles.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    staffCount: role._count.users,
    permissionIds: role.permissions.map((row) => row.permissionId),
    permissionKeys: role.permissions.map((row) => row.permission.key),
    staff: role.users.map((row) => ({
      id: row.user.id,
      name: `${row.user.firstName} ${row.user.lastName}`.trim(),
      email: row.user.email,
      employeeNumber: row.user.staffProfile?.employeeNumber ?? null,
      department: row.user.staffProfile?.department?.name ?? null,
      status: row.user.staffProfile?.status ?? row.user.status,
    })),
  }));

  return {
    stats: {
      totalRoles: mappedRoles.length,
      totalStaff,
      customRoles: mappedRoles.filter((role) => !role.isSystem).length,
      systemRoles: mappedRoles.filter((role) => role.isSystem).length,
    },
    roles: mappedRoles,
    permissions,
    modules: ROLE_PERMISSION_MODULES,
    assignableStaff: staffUsers.map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      employeeNumber: user.staffProfile?.employeeNumber ?? null,
      department: user.staffProfile?.department?.name ?? null,
      status: user.staffProfile?.status ?? user.status,
      roleIds: user.roles.map((row) => row.roleId),
    })),
  };
}

export async function assignStaffToRole(
  tenantId: string,
  roleId: string,
  userIds: string[],
) {
  const role = await prisma.role.findFirst({
    where: tenantScope(tenantId, { id: roleId }),
    select: { id: true },
  });
  if (!role) throw new AppError(404, "Role not found", "ROLE_NOT_FOUND");

  const unique = [...new Set(userIds)];
  if (unique.length) {
    const count = await prisma.user.count({
      where: tenantScope(tenantId, { id: { in: unique } }),
    });
    if (count !== unique.length) {
      throw new AppError(400, "One or more staff users are invalid", "INVALID_USER");
    }
  }

  await prisma.$transaction(
    unique.map((userId) =>
      prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        create: { userId, roleId, tenantId },
        update: { tenantId },
      }),
    ),
  );

  for (const userId of unique) {
    invalidateAuthCacheForUser(userId);
  }

  return getStaffRolesSetup(tenantId);
}

export async function removeStaffFromRole(
  tenantId: string,
  roleId: string,
  userId: string,
) {
  const role = await prisma.role.findFirst({
    where: tenantScope(tenantId, { id: roleId }),
    select: { id: true },
  });
  if (!role) throw new AppError(404, "Role not found", "ROLE_NOT_FOUND");

  const result = await prisma.userRole.deleteMany({
    where: { tenantId, roleId, userId },
  });
  if (!result.count) throw new AppError(404, "Staff assignment not found", "ASSIGNMENT_NOT_FOUND");

  invalidateAuthCacheForUser(userId);
  return getStaffRolesSetup(tenantId);
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
  const phone = normalizeSmsNumber(input.phone ?? "");
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    throw new AppError(400, "A valid mobile number is required", "PHONE_REQUIRED");
  }
  await assertTenantRoles(tenantId, input.roleIds);
  const exists = await prisma.user.findFirst({ where: tenantScope(tenantId, { email }) });
  if (exists) throw new AppError(409, "Email already exists", "USER_EXISTS");

  return prisma.user.create({
    data: {
      tenantId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone,
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

  const phone =
    input.phone === undefined
      ? undefined
      : normalizeSmsNumber(input.phone ?? "");
  if (phone !== undefined && (!phone || phone.replace(/\D/g, "").length < 10)) {
    throw new AppError(400, "A valid mobile number is required", "PHONE_REQUIRED");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.roleIds) {
      await tx.userRole.deleteMany({ where: { userId, tenantId } });
    }
    return tx.user.update({
      where: { id: userId },
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone,
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

  invalidateAuthCacheForUser(userId);
  return updated;
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
    invalidateAuthCacheForUser(userId);
    return { mode: "disabled" as const, user: data };
  }

  await prisma.userRole.deleteMany({ where: { userId, tenantId } });
  await prisma.user.delete({ where: { id: userId } });
  invalidateAuthCacheForUser(userId);
  return { mode: "deleted" as const, id: userId };
}
