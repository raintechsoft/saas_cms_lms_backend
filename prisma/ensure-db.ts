import mysql from "mysql2/promise";

const defaultUrl = "mysql://root@127.0.0.1:3306/saas-cms-lms-db";
const url = new URL(process.env.DATABASE_URL ?? defaultUrl);
const dbName = decodeURIComponent(url.pathname.replace(/^\//, "") || "saas-cms-lms-db");

const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username || "root"),
  password: decodeURIComponent(url.password || ""),
});

try {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  console.log(`Database ready: ${dbName}`);
} finally {
  await connection.end();
}
