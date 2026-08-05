import { createHmac, timingSafeEqual } from "node:crypto";

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

export interface RazorpayCreateOrderInput {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

function basicAuth(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function createOrder(
  credentials: { keyId: string; keySecret: string },
  input: RazorpayCreateOrderInput,
): Promise<RazorpayOrder> {
  const response = await fetch(RAZORPAY_ORDERS_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(credentials.keyId, credentials.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | RazorpayOrder
    | { error?: { description?: string } }
    | null;

  if (!response.ok) {
    const message =
      body && "error" in body && body.error?.description
        ? body.error.description
        : "Razorpay order creation failed";
    throw new Error(message);
  }

  if (!body || !("id" in body)) {
    throw new Error("Razorpay returned an invalid order response");
  }

  return body;
}

function digestBody(rawBody: Buffer | string) {
  return typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
}

export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string,
) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(digestBody(rawBody)).digest("hex");
  try {
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");
    if (expectedBuffer.length !== signatureBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}) {
  if (!input.orderId || !input.paymentId || !input.signature || !input.keySecret) {
    return false;
  }
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = createHmac("sha256", input.keySecret).update(payload).digest("hex");
  try {
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureBuffer = Buffer.from(input.signature, "utf8");
    if (expectedBuffer.length !== signatureBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}
