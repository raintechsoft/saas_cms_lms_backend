/**
 * Creates/resets demo-school teacher login: teacher@demo-school.local / ChangeMe123!
 * Usage: npx tsx prisma/reset-demo-teacher-password.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "teacher@demo-school.local";
  const password = process.env.DEMO_TEACHER_PASSWORD ?? "ChangeMe123!";
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-school" } });
  if (!tenant) throw new Error("demo-school tenant missing — run npm run prisma:seed first");

  const teacherRole = await prisma.role.findFirst({
    where: { tenantId: tenant.id, code: "TEACHER" },
  });
  if (!teacherRole) throw new Error("TEACHER role missing — run npm run prisma:seed first");

  const passwordHash = await bcrypt.hash(password, 12);
  const teacher = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: {
      firstName: "Anita",
      lastName: "Sharma",
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      tenantId: tenant.id,
      email,
      passwordHash,
      firstName: "Anita",
      lastName: "Sharma",
      status: "ACTIVE",
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: teacher.id, roleId: teacherRole.id } },
    update: { tenantId: tenant.id },
    create: { userId: teacher.id, roleId: teacherRole.id, tenantId: tenant.id },
  });

  console.log("Teacher ready:", email, "on slug demo-school");
  console.log("password_length", password.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
