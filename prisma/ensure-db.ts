import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env and set your PostgreSQL credentials.");
}

const url = new URL(databaseUrl);
const dbName = decodeURIComponent(url.pathname.replace(/^\//, "") || "saas_cms_lms");

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query("SELECT 1");
  console.log(`Database ready: ${dbName} (user: ${decodeURIComponent(url.username)})`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Could not connect with DATABASE_URL.");
  console.error("Check:");
  console.error("  1) User/password in .env match pgAdmin");
  console.error("  2) Database exists (create saas_cms_lms in pgAdmin if needed)");
  console.error("  3) Encode @ in password as %40");
  throw error instanceof Error ? error : new Error(message);
} finally {
  await client.end().catch(() => undefined);
}
