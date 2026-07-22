import { env } from "./config/env.js";
import { isMailConfigured } from "./lib/mail.js";
import { prisma } from "./lib/prisma.js";
import { app } from "./app.js";

const server = app.listen(env.API_PORT, () => {
  console.log(`SaaS CMS LMS API listening on http://localhost:${env.API_PORT}`);
  console.log(
    isMailConfigured()
      ? "[mail] SMTP configured — OTP and password-reset emails will be delivered"
      : "[mail] SMTP not configured — OTP/reset codes log to console in development",
  );
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
