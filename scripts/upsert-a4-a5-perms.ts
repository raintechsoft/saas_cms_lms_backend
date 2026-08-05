import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const perms = [
  ["transport.view", "View transport routes and assignments"],
  ["transport.manage", "Manage transport routes and assignments"],
  ["hostel.view", "View hostel blocks, rooms, and assignments"],
  ["hostel.manage", "Manage hostel blocks, rooms, and assignments"],
] as const;

async function main() {
  for (const [key, description] of perms) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description },
      update: { description },
    });
  }

  const adminRoles = await prisma.role.findMany({
    where: { code: "INSTITUTION_ADMIN" },
  });

  for (const adminRole of adminRoles) {
    for (const [key] of perms) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id },
        },
        create: { roleId: adminRole.id, permissionId: perm.id },
        update: {},
      });
    }
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  for (const t of tenants) {
    for (const moduleKey of ["transport", "hostel"] as const) {
      await prisma.tenantModuleSetting.upsert({
        where: { tenantId_moduleKey: { tenantId: t.id, moduleKey } },
        create: {
          tenantId: t.id,
          moduleKey,
          adminEnabled: true,
          studentEnabled: true,
          parentEnabled: true,
        },
        update: { adminEnabled: true },
      });
    }
  }

  console.log("permissions+modules ok", {
    adminRoles: adminRoles.length,
    tenants: tenants.length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
