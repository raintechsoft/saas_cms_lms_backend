import { isMailConfigured, verifyMailConnection } from "../src/lib/mail.js";

async function main() {
  if (!isMailConfigured()) {
    console.error("SMTP is not configured.");
    console.error("Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env then retry.");
    process.exitCode = 1;
    return;
  }

  const result = await verifyMailConnection();
  if (!result.ok) {
    console.error(`SMTP verify failed: ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  console.log("SMTP connection OK — ready to send OTP and password-reset emails.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
