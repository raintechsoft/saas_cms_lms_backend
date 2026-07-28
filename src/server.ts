import { env, isPushEnvConfigured, isTwilioEnvConfigured } from "./config/env.js";
import { isMailConfigured } from "./lib/mail.js";
import { prisma } from "./lib/prisma.js";
import { ensureLocalUploadDirs, getStorageDriver } from "./lib/uploads.js";
import { processScheduledFeeReminders } from "./modules/fees/fee-reminders.service.js";
import { app } from "./app.js";

await ensureLocalUploadDirs();

const REMINDER_TICK_MS = 60_000;

const server = app.listen(env.API_PORT, () => {
  console.log(`SaaS CMS LMS API listening on http://localhost:${env.API_PORT}`);
  console.log(
    isMailConfigured()
      ? "[mail] SMTP configured — OTP and password-reset emails will be delivered"
      : "[mail] SMTP not configured — OTP/reset codes log to console in development",
  );
  console.log(
    isTwilioEnvConfigured()
      ? "[sms] Twilio env configured — fee reminders can send SMS"
      : "[sms] Twilio env not set — use ERP SMS settings or TWILIO_* / Twilio_* in .env",
  );
  console.log(
    getStorageDriver() === "s3"
      ? "[storage] Driver=s3 — avatars upload to cloud storage"
      : "[storage] Driver=local — avatars saved under ./uploads/avatars",
  );
  console.log(
    isPushEnvConfigured()
      ? "[push] Web push configured — browsers can receive notifications"
      : "[push] Push env not set — configure PUSH_VAPID_* to enable browser push",
  );
  console.log("[fee-reminders] Scheduler armed (every 60s)");
});

const reminderTimer = setInterval(() => {
  void processScheduledFeeReminders().catch((error) => {
    const message = error instanceof Error ? error.message : "scheduler failed";
    console.error(`[fee-reminders] ${message}`);
  });
}, REMINDER_TICK_MS);
reminderTimer.unref?.();

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down`);
  clearInterval(reminderTimer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
