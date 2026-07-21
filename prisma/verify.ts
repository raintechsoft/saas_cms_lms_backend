import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const expected =
  process.env.DATABASE_URL != null
    ? decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ""))
    : "saas_cms_lms";

try {
  await prisma.$queryRaw`SELECT 1`;
  const database = await prisma.$queryRaw<Array<{ database_name: string | null }>>`
    SELECT current_database() AS database_name
  `;
  const name = database[0]?.database_name;
  if (name !== expected) {
    throw new Error(`Connected to "${name ?? "no database"}", expected "${expected}"`);
  }
  console.log(`PostgreSQL connection verified: ${name}`);
} finally {
  await prisma.$disconnect();
}
