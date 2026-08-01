import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-school" } });
  if (!tenant) throw new Error("demo-school tenant missing");

  const rows = await prisma.studentEnrollment.findMany({
    where: {
      tenantId: tenant.id,
      status: "ACTIVE",
      classSection: {
        academicClass: { name: { contains: "10" } },
        section: { name: "A" },
      },
    },
    include: {
      student: { include: { user: { select: { id: true, email: true, status: true } } } },
      classSection: { include: { academicClass: true, section: true } },
    },
    take: 20,
  });

  console.log("FOUND", rows.length);
  for (const row of rows) {
    console.log(
      [
        row.student.admissionNumber,
        row.student.firstName,
        row.student.lastName ?? "",
        row.student.user?.email ?? "NO_LOGIN",
        row.student.user?.status ?? "-",
        `${row.classSection.academicClass.name} ${row.classSection.section.name}`,
      ].join(" | "),
    );
  }

  // Ensure demo student login works for Class 10 A seed student
  const email = "student@demo-school.local";
  const password = "ChangeMe123!";
  let user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });

  if (!user) {
    const student = await prisma.student.findFirst({
      where: { tenantId: tenant.id, admissionNumber: "SCL-1" },
    });
    if (!student) throw new Error("SCL-1 student missing — run seed");
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: student.firstName,
        lastName: student.lastName ?? "",
        status: "ACTIVE",
      },
    });
    await prisma.student.update({
      where: { id: student.id },
      data: { userId: user.id },
    });
    const studentRole = await prisma.role.findFirst({
      where: { tenantId: tenant.id, code: "STUDENT" },
    });
    if (studentRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: studentRole.id } },
        update: { tenantId: tenant.id },
        create: { userId: user.id, roleId: studentRole.id, tenantId: tenant.id },
      });
    }
    console.log("CREATED_LOGIN", email);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 12), status: "ACTIVE" },
    });
    console.log("RESET_LOGIN", email);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
