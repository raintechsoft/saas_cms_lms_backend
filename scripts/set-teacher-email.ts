import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const NEW_EMAIL = "sujithsanthosh710@gmail.com";

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "demo-school" } });
  if (!tenant) throw new Error("demo-school tenant not found — run npm run db:seed first");

  const teacherRole = await prisma.role.findFirst({
    where: { tenantId: tenant.id, code: "TEACHER" },
  });
  if (!teacherRole) throw new Error("TEACHER role not found");

  const existingTeacher = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      roles: { some: { roleId: teacherRole.id } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!existingTeacher) throw new Error("No teacher user found");

  const emailTaken = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      email: NEW_EMAIL,
      NOT: { id: existingTeacher.id },
    },
  });
  if (emailTaken) {
    throw new Error(`${NEW_EMAIL} is already used by another user in demo-school`);
  }

  const updated = await prisma.user.update({
    where: { id: existingTeacher.id },
    data: {
      email: NEW_EMAIL,
      status: "ACTIVE",
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  console.log("Teacher login updated:");
  console.log(JSON.stringify(updated, null, 2));
  console.log("Workspace: demo-school");
  console.log("Password (unchanged unless you reset): ChangeMe123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
