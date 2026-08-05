import {
  OnlineFeeGateway,
  OnlineFeeOrderStatus,
  PaymentMode,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env.js";
import { recordAudit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getTenantIntegration } from "../erp/erp.service.js";
import { collectPayment, listStudentFees } from "./fees.service.js";
import {
  createOrder as createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "./providers/razorpay.provider.js";

type OrderItem = { assignmentId: string; amount: number };

interface ResolvedCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  currency: string;
  enabled: boolean;
}

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string } };
    order?: { entity?: { id?: string } };
  };
}

function parseItems(value: Prisma.JsonValue): OrderItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const assignmentId = typeof row.assignmentId === "string" ? row.assignmentId : "";
      const amount = Number(row.amount);
      if (!assignmentId || !Number.isFinite(amount) || amount <= 0) return null;
      return { assignmentId, amount };
    })
    .filter((item): item is OrderItem => item !== null);
}

async function resolveCredentials(tenantId: string): Promise<ResolvedCredentials> {
  const integration = await getTenantIntegration(tenantId, "PAYMENT");
  const config = (integration?.config ?? {}) as Record<string, unknown>;
  const secrets = integration?.secrets ?? {};

  const keyId = String(secrets.keyId || env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(secrets.keySecret || env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = String(
    secrets.webhookSecret || env.RAZORPAY_WEBHOOK_SECRET || "",
  ).trim();
  const currency = typeof config.currency === "string" && config.currency.trim()
    ? config.currency.trim().toUpperCase()
    : "INR";
  const enabled = Boolean(
    keyId &&
      keySecret &&
      (integration?.isEnabled === true ||
        (!integration && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)),
  );

  return { keyId, keySecret, webhookSecret, currency, enabled };
}

export async function getOnlinePaymentConfig(tenantId: string) {
  const creds = await resolveCredentials(tenantId);
  return {
    enabled: creds.enabled,
    keyId: creds.enabled ? creds.keyId : "",
    currency: creds.currency,
  };
}

async function validateOrderItems(
  tenantId: string,
  input: {
    studentId: string;
    academicSessionId: string;
    items: OrderItem[];
  },
) {
  if (!input.items.length) {
    throw new AppError(400, "At least one fee item is required", "INVALID_ORDER_ITEMS");
  }
  const uniqueItems = new Map(input.items.map((item) => [item.assignmentId, item]));
  if (uniqueItems.size !== input.items.length) {
    throw new AppError(400, "Duplicate fee assignment in order", "DUPLICATE_ORDER_ITEM");
  }

  const statement = await listStudentFees(
    tenantId,
    input.studentId,
    input.academicSessionId,
  );
  const balanceByAssignment = new Map(
    statement.assignments.map((assignment) => [assignment.id, assignment.totals.balance]),
  );

  for (const item of input.items) {
    const balance = balanceByAssignment.get(item.assignmentId);
    if (balance === undefined) {
      throw new AppError(400, "Fee assignment is invalid", "INVALID_FEE_ASSIGNMENT");
    }
    if (item.amount <= 0 || item.amount > balance + 0.001) {
      throw new AppError(400, "Payment exceeds the outstanding balance", "INVALID_AMOUNT");
    }
  }
}

export async function createOnlineOrder(
  tenantId: string,
  userId: string,
  input: {
    studentId: string;
    academicSessionId: string;
    items: OrderItem[];
  },
) {
  const creds = await resolveCredentials(tenantId);
  if (!creds.enabled) {
    throw new AppError(400, "Online payments are not enabled", "ONLINE_PAYMENTS_DISABLED");
  }

  await validateOrderItems(tenantId, input);

  const amount = input.items.reduce((sum, item) => sum + item.amount, 0);
  if (amount <= 0) {
    throw new AppError(400, "Order amount must be greater than zero", "INVALID_ORDER_AMOUNT");
  }

  const [student, session, tenant, user] = await Promise.all([
    prisma.student.findFirst({ where: tenantScope(tenantId, { id: input.studentId }) }),
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: input.academicSessionId }),
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    prisma.user.findFirst({
      where: tenantScope(tenantId, { id: userId }),
      select: { firstName: true, lastName: true, email: true, phone: true },
    }),
  ]);
  if (!student || !session) {
    throw new AppError(400, "Student or session is invalid", "INVALID_ORDER_REFERENCE");
  }

  const order = await prisma.onlineFeeOrder.create({
    data: {
      tenantId,
      studentId: input.studentId,
      academicSessionId: input.academicSessionId,
      amount,
      currency: creds.currency,
      status: OnlineFeeOrderStatus.PENDING,
      gateway: OnlineFeeGateway.RAZORPAY,
      items: input.items as Prisma.InputJsonValue,
      createdByUserId: userId,
    },
  });

  try {
    const gatewayOrder = await createRazorpayOrder(
      { keyId: creds.keyId, keySecret: creds.keySecret },
      {
        amountPaise: Math.round(amount * 100),
        currency: creds.currency,
        receipt: order.id,
        notes: {
          tenantId,
          studentId: input.studentId,
          academicSessionId: input.academicSessionId,
        },
      },
    );

    const saved = await prisma.onlineFeeOrder.update({
      where: { id: order.id },
      data: { gatewayOrderId: gatewayOrder.id },
    });

    await recordAudit(tenantId, userId, "ONLINE_FEE_ORDER_CREATED", "OnlineFeeOrder", saved.id, {
      amount,
      gatewayOrderId: gatewayOrder.id,
    });

    const payerName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
      || [student.firstName, student.lastName].filter(Boolean).join(" ").trim();
    const contact = user?.phone || student.guardianPhone || student.fatherPhone || student.mobile || undefined;

    return {
      order: saved,
      checkout: {
        keyId: creds.keyId,
        orderId: gatewayOrder.id,
        amount: Math.round(amount * 100),
        currency: creds.currency,
        name: tenant?.name ?? "School Fees",
        description: `Fee payment for ${student.firstName}`,
        prefill: {
          name: payerName || undefined,
          email: user?.email || student.email || undefined,
          contact,
        },
      },
    };
  } catch (error) {
    await prisma.onlineFeeOrder.update({
      where: { id: order.id },
      data: { status: OnlineFeeOrderStatus.FAILED },
    });
    const message = error instanceof Error ? error.message : "Unable to create gateway order";
    throw new AppError(502, message, "GATEWAY_ORDER_FAILED");
  }
}

export async function getOnlineOrder(tenantId: string, id: string) {
  const order = await prisma.onlineFeeOrder.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      feePayment: {
        select: {
          id: true,
          receiptNumber: true,
          paymentId: true,
          paymentDate: true,
          amount: true,
        },
      },
    },
  });
  if (!order) throw new AppError(404, "Online order not found", "ONLINE_ORDER_NOT_FOUND");
  return order;
}

async function captureSuccessfulOrder(
  order: {
    id: string;
    tenantId: string;
    studentId: string;
    academicSessionId: string;
    status: OnlineFeeOrderStatus;
    feePaymentId: string | null;
    createdByUserId: string;
    items: Prisma.JsonValue;
    gatewayOrderId: string | null;
  },
  gatewayPaymentId: string,
  gatewaySignature?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  if (order.status === OnlineFeeOrderStatus.SUCCESS && order.feePaymentId) {
    return prisma.onlineFeeOrder.findFirst({
      where: { id: order.id },
      include: {
        feePayment: {
          select: {
            id: true,
            receiptNumber: true,
            paymentId: true,
            paymentDate: true,
            amount: true,
          },
        },
      },
    });
  }

  const items = parseItems(order.items);
  const payment = await collectPayment(order.tenantId, order.createdByUserId, {
    studentId: order.studentId,
    academicSessionId: order.academicSessionId,
    paymentDate: new Date(),
    paymentMode: PaymentMode.ONLINE,
    note: `Razorpay ${gatewayPaymentId}`,
    items,
  });

  const updated = await prisma.onlineFeeOrder.update({
    where: { id: order.id },
    data: {
      status: OnlineFeeOrderStatus.SUCCESS,
      feePaymentId: payment.id,
      gatewayPaymentId,
      gatewaySignature: gatewaySignature ?? undefined,
      metadata: metadata ?? undefined,
    },
    include: {
      feePayment: {
        select: {
          id: true,
          receiptNumber: true,
          paymentId: true,
          paymentDate: true,
          amount: true,
        },
      },
    },
  });

  await recordAudit(
    order.tenantId,
    order.createdByUserId,
    "ONLINE_FEE_ORDER_CAPTURED",
    "OnlineFeeOrder",
    order.id,
    {
      gatewayPaymentId,
      gatewayOrderId: order.gatewayOrderId,
      feePaymentId: payment.id,
    },
  );

  return updated;
}

function extractWebhookEvent(payload: RazorpayWebhookPayload) {
  const event = payload.event ?? "";
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;
  const gatewayOrderId = payment?.order_id ?? order?.id ?? null;
  const gatewayPaymentId = payment?.id ?? null;
  return { event, gatewayOrderId, gatewayPaymentId, paymentStatus: payment?.status ?? null };
}

export async function handleRazorpayWebhook(rawBody: Buffer | string, signature: string) {
  const payload = JSON.parse(
    typeof rawBody === "string" ? rawBody : rawBody.toString("utf8"),
  ) as RazorpayWebhookPayload;

  const { event, gatewayOrderId, gatewayPaymentId } = extractWebhookEvent(payload);
  if (!gatewayOrderId) {
    throw new AppError(400, "Webhook payload missing order id", "WEBHOOK_INVALID");
  }

  const order = await prisma.onlineFeeOrder.findFirst({
    where: { gatewayOrderId },
  });
  if (!order) {
    throw new AppError(404, "Online order not found for webhook", "ONLINE_ORDER_NOT_FOUND");
  }

  const creds = await resolveCredentials(order.tenantId);
  if (!creds.webhookSecret || !verifyWebhookSignature(rawBody, signature, creds.webhookSecret)) {
    throw new AppError(401, "Webhook signature verification failed", "WEBHOOK_SIGNATURE_INVALID");
  }

  await recordAudit(
    order.tenantId,
    order.createdByUserId,
    "RAZORPAY_WEBHOOK_RECEIVED",
    "OnlineFeeOrder",
    order.id,
    { event, gatewayOrderId, gatewayPaymentId },
  );

  if (event === "payment.failed") {
    if (order.status === OnlineFeeOrderStatus.PENDING) {
      await prisma.onlineFeeOrder.update({
        where: { id: order.id },
        data: { status: OnlineFeeOrderStatus.FAILED, metadata: payload as Prisma.InputJsonValue },
      });
    }
    return { processed: true, status: OnlineFeeOrderStatus.FAILED };
  }

  if (event === "payment.captured" || event === "order.paid") {
    if (!gatewayPaymentId) {
      throw new AppError(400, "Webhook payload missing payment id", "WEBHOOK_INVALID");
    }
    const captured = await captureSuccessfulOrder(
      order,
      gatewayPaymentId,
      signature,
      payload as Prisma.InputJsonValue,
    );
    return { processed: true, status: captured?.status ?? OnlineFeeOrderStatus.SUCCESS };
  }

  return { processed: false, status: order.status };
}

export async function confirmCheckout(
  tenantId: string,
  orderId: string,
  input: { paymentId: string; signature: string },
) {
  const order = await prisma.onlineFeeOrder.findFirst({
    where: tenantScope(tenantId, { id: orderId }),
  });
  if (!order) throw new AppError(404, "Online order not found", "ONLINE_ORDER_NOT_FOUND");
  if (!order.gatewayOrderId) {
    throw new AppError(409, "Gateway order is not ready", "ONLINE_ORDER_NOT_READY");
  }

  const creds = await resolveCredentials(tenantId);
  const valid = verifyPaymentSignature({
    orderId: order.gatewayOrderId,
    paymentId: input.paymentId,
    signature: input.signature,
    keySecret: creds.keySecret,
  });
  if (!valid) {
    throw new AppError(401, "Payment signature verification failed", "PAYMENT_SIGNATURE_INVALID");
  }

  return captureSuccessfulOrder(order, input.paymentId, input.signature);
}
