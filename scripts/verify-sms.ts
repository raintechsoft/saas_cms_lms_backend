import { env, isTwilioEnvConfigured } from "../src/config/env.js";
import { normalizeSmsNumber } from "../src/lib/sms.js";

const toArg = process.argv[2];

if (!isTwilioEnvConfigured()) {
  console.error("Twilio env is not configured.");
  console.error("Set Twilio_ACCOUNT_SID, Twilio_AUTH_TOKEN, Twilio_PHONE_NUMBER in .env");
  process.exit(1);
}

const accountSid = env.TWILIO_ACCOUNT_SID!;
const authToken = env.TWILIO_AUTH_TOKEN!;
const fromNumber = normalizeSmsNumber(env.TWILIO_FROM_NUMBER!);
const toNumber = normalizeSmsNumber(toArg || "");

console.log("Twilio check");
console.log(`- Account SID length: ${accountSid.length} (expected ~34, starts with AC)`);
console.log(`- Account SID prefix: ${accountSid.slice(0, 4)}...`);
console.log(`- Auth token length: ${authToken.length}`);
console.log(`- From: ${fromNumber}`);
console.log(`- To:   ${toNumber || "(pass a number: npm run sms:verify -- +918086136588)"}`);

if (accountSid.length !== 34) {
  console.warn(
    "WARNING: Twilio Account SID is usually exactly 34 characters (AC + 32). Yours looks wrong — copy again from Twilio Console home.",
  );
}
if (fromNumber.startsWith("+91")) {
  console.warn(
    "WARNING: From looks like an Indian personal number. On Twilio trial, From must be your Twilio number (often +1...). Put +91... on the student as To.",
  );
}
if (!toNumber) {
  process.exit(0);
}

const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
const response = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: toNumber,
      From: fromNumber,
      Body: "SaaS CMS LMS SMS test",
    }),
  },
);

const text = await response.text();
console.log(`HTTP ${response.status}`);
console.log(text);
process.exit(response.ok ? 0 : 1);
