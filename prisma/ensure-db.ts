import "dotenv/config";
import pg from "pg";

/** Checks DATABASE_URL only. Does not create DBs as postgres superuser. */
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Copy .env.example to .env and set PostgreSQL credentials.",
  );
}

if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
  throw new Error("DATABASE_URL must start with postgresql://");
}

const url = new URL(databaseUrl);
const dbName = decodeURIComponent(url.pathname.replace(/^\//, "") || "saas_cms_lms");
const username = decodeURIComponent(url.username || "");

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("SELECT 1");
  console.log(`Database ready: ${dbName} (user: ${username})`);
} catch (error) {
  console.error("Could not connect with DATABASE_URL.");
  console.error("Check:");
  console.error("  1) User/password match pgAdmin / SQL Shell");
  console.error("  2) Database exists (saas_cms_lms)");
  console.error("  3) Encode @ in password as %40 (example: pass@1 -> pass%401)");
  console.error("  4) schema.prisma provider must be postgresql");
  throw error instanceof Error ? error : new Error(String(error));
} finally {
  await client.end().catch(() => undefined);
}
