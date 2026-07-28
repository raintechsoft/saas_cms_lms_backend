import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: { firstName: { contains: "anwin", mode: "insensitive" } },
    select: {
      admissionNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      userId: true,
      user: { select: { email: true, status: true } },
    },
  });
  console.log(JSON.stringify(students, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
