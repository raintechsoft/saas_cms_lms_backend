import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

const DEFAULT_TENANT_ROLES = [
  {
    code: "TEACHER",
    name: "Teacher",
    permissions: [
      "students.view",
      "academics.view",
      "sessions.view",
      "attendance.view",
      "attendance.manage",
      "exams.view",
      "exams.manage",
      "documents.view",
      "documents.generate",
      "timetable.view",
      "homework.view",
      "homework.manage",
      "homework.evaluate",
    ],
  },
  {
    code: "ACCOUNTANT",
    name: "Accountant",
    permissions: [
      "students.view",
      "sessions.view",
      "fees.view",
      "fees.manage",
      "fees.collect",
      "hr.view",
      "payroll.manage",
      "reports.view",
    ],
  },
  {
    code: "STAFF",
    name: "Staff",
    permissions: [
      "students.view",
      "academics.view",
      "sessions.view",
      "attendance.view",
      "attendance.manage",
      "hr.view",
      "timetable.view",
      "timetable.manage",
      "homework.view",
      "homework.manage",
      "homework.evaluate",
    ],
  },
  {
    code: "STUDENT",
    name: "Student",
    permissions: ["timetable.view", "homework.view", "homework.submit"],
  },
  {
    code: "PARENT",
    name: "Parent",
    permissions: ["timetable.view", "homework.view"],
  },
] as const;

type DbClient = Prisma.TransactionClient | typeof prisma;

function currentAcademicSessionBounds() {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name: `${startYear}-${startYear + 1}`,
    startDate: new Date(`${startYear}-04-01T00:00:00.000Z`),
    endDate: new Date(`${startYear + 1}-03-31T00:00:00.000Z`),
  };
}

export async function bootstrapTenantWorkspace(tenantId: string, client: DbClient = prisma) {
  const session = currentAcademicSessionBounds();
  await client.tenantSetting.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      email: null,
      currency: "INR",
      timezone: "Asia/Kolkata",
      autoAdmissionNumber: true,
      admissionPrefix: "ADM-",
      nextAdmissionNumber: 1,
      onlineAdmission: false,
    },
  });
  await client.academicSession.upsert({
    where: { tenantId_name: { tenantId, name: session.name } },
    update: { isCurrent: true },
    create: {
      tenantId,
      name: session.name,
      startDate: session.startDate,
      endDate: session.endDate,
      isCurrent: true,
    },
  });
}

export async function ensureInstitutionAdminRole(tenantId: string, client: DbClient = prisma) {
  const role = await client.role.upsert({
    where: { tenantId_code: { tenantId, code: "INSTITUTION_ADMIN" } },
    update: { name: "Institution Admin" },
    create: {
      tenantId,
      code: "INSTITUTION_ADMIN",
      name: "Institution Admin",
      isSystem: true,
    },
  });
  const permissions = await client.permission.findMany({
    where: { key: { notIn: ["platform.manage", "tenants.manage"] } },
  });
  await client.rolePermission.deleteMany({ where: { roleId: role.id } });
  if (permissions.length) {
    await client.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    });
  }
  return role;
}

export async function ensureTenantRoles(tenantId: string, client: DbClient = prisma) {
  const permissions = await client.permission.findMany({
    select: { id: true, key: true },
  });
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  for (const definition of DEFAULT_TENANT_ROLES) {
    const role = await client.role.upsert({
      where: { tenantId_code: { tenantId, code: definition.code } },
      update: { name: definition.name },
      create: {
        tenantId,
        code: definition.code,
        name: definition.name,
        isSystem: true,
      },
    });

    await client.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permissionIds = definition.permissions
      .map((key) => permissionByKey.get(key))
      .filter((id): id is string => Boolean(id));
    if (permissionIds.length) {
      await client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
    }
  }
}
