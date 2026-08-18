import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

{
  try {
    const dbUrl = new URL(env.DATABASE_URL);
    console.log(
      `[database] prisma pool connection_limit=${dbUrl.searchParams.get("connection_limit") ?? "default"} pool_timeout=${dbUrl.searchParams.get("pool_timeout") ?? "default"}s`,
    );
  } catch {
    console.warn("[database] DATABASE_URL is not a valid URI");
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
