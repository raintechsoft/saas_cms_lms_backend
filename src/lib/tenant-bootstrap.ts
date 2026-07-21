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
