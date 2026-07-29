import { env, isMsg91EnvConfigured } from "../src/config/env.js";
import { normalizeSmsNumber, toMsg91Mobile } from "../src/lib/sms.js";

const toArg = process.argv[2];

if (!isMsg91EnvConfigured()) {
  console.error("MSG91 env is not configured.");
  console.error("Set MSG91_AUTH_KEY and MSG91_SENDER_ID in .env");
  console.error("Optional: MSG91_TEMPLATE_ID (recommended for India DLT)");
  process.exit(1);
}

const authKey = env.MSG91_AUTH_KEY!;
const senderId = env.MSG91_SENDER_ID!;
const templateId = env.MSG91_TEMPLATE_ID ?? "";
const toNumber = normalizeSmsNumber(toArg || "");
const mobile = toArg ? toMsg91Mobile(toArg) : "";

console.log("MSG91 check");
console.log(`- Auth key length: ${authKey.length}`);
console.log(`- Sender ID: ${senderId}`);
console.log(`- Template/Flow ID: ${templateId || "(not set — will use sendhttp)"}`);
console.log(`- To (E.164): ${toNumber || "(pass a number: npm run sms:verify -- +918086136588)"}`);
console.log(`- To (MSG91): ${mobile || "-"}`);

if (!mobile) {
  process.exit(0);
}

const body = "SaaS CMS LMS SMS test via MSG91";

let response: Response;
if (templateId) {
  response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: authKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      sender: senderId,
      short_url: "0",
      recipients: [{ mobiles: mobile, VAR1: body, var: body }],
    }),
  });
} else {
  const url = new URL("https://api.msg91.com/api/sendhttp.php");
  url.searchParams.set("authkey", authKey);
  url.searchParams.set("mobiles", mobile);
  url.searchParams.set("message", body);
  url.searchParams.set("sender", senderId);
  url.searchParams.set("route", "4");
  url.searchParams.set("country", "91");
  response = await fetch(url, { method: "GET" });
}

const text = await response.text();
console.log(`HTTP ${response.status}`);
console.log(text);
process.exit(response.ok ? 0 : 1);
