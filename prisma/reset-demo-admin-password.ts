/**
 * Resets demo-school institution admin password from DEMO_ADMIN_PASSWORD (or default).
 * Usage: npx tsx prisma/reset-demo-admin-password.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.DEMO_ADMIN_EMAIL ?? "admin@demo-school.local").toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD ?? "ChangeMe123!";
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-school" } });
  if (!tenant) throw new Error("demo-school tenant missing");

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (!user) throw new Error(`User ${email} missing for demo-school`);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12), status: "ACTIVE" },
  });

  console.log("Reset password for", email, "on slug demo-school");
  console.log("password_length", password.length);
  console.log("password_ok_default", password === "ChangeMe123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
