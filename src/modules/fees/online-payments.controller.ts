import type { Request, Response } from "express";
import { z } from "zod";
import {
  assertAccessibleStudent,
  assertProductMode,
  type PortalViewer,
} from "../portal/portal-access.js";
import {
  confirmCheckout,
  createOnlineOrder,
  getOnlineOrder,
  getOnlinePaymentConfig,
  handleRazorpayWebhook,
} from "./online-payments.service.js";

const idParams = z.object({ id: z.string().min(1) });
const studentParams = z.object({ studentId: z.string().min(1) });

const orderItemBody = z.object({
  assignmentId: z.string().min(1),
  amount: z.coerce.number().positive(),
});

const createOrderBody = z.object({
  studentId: z.string().min(1),
  academicSessionId: z.string().min(1),
  items: z.array(orderItemBody).min(1),
});

const confirmBody = z.object({
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

function portalViewer(req: Request): PortalViewer {
  return { userId: req.auth!.userId, roles: req.auth!.roles };
}

export async function getOnlinePaymentConfigController(req: Request, res: Response) {
  res.json({ data: await getOnlinePaymentConfig(req.auth!.tenantId!) });
}

export async function createOnlineOrderController(req: Request, res: Response) {
  const body = createOrderBody.parse(req.body);
  const result = await createOnlineOrder(req.auth!.tenantId!, req.auth!.userId, body);
  res.status(201).json({ data: result });
}

export async function getOnlineOrderController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getOnlineOrder(req.auth!.tenantId!, id) });
}

export async function confirmOnlineOrderController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = confirmBody.parse(req.body);
  res.json({ data: await confirmCheckout(req.auth!.tenantId!, id, body) });
}

export async function createPortalOnlineOrderController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  const tenantId = req.auth!.tenantId!;
  await assertAccessibleStudent(tenantId, portalViewer(req), studentId);
  assertProductMode(req.auth!.productMode, "CMS");

  const body = createOrderBody.parse(req.body);
  if (body.studentId !== studentId) {
    res.status(400).json({
      error: { code: "STUDENT_MISMATCH", message: "Student id does not match the route" },
    });
    return;
  }

  const result = await createOnlineOrder(tenantId, req.auth!.userId, body);
  res.status(201).json({ data: result });
}

export async function getPortalOnlineOrderController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const tenantId = req.auth!.tenantId!;
  const order = await getOnlineOrder(tenantId, id);
  await assertAccessibleStudent(tenantId, portalViewer(req), order.studentId);
  assertProductMode(req.auth!.productMode, "CMS");
  res.json({ data: order });
}

export async function confirmPortalOnlineOrderController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const tenantId = req.auth!.tenantId!;
  const existing = await getOnlineOrder(tenantId, id);
  await assertAccessibleStudent(tenantId, portalViewer(req), existing.studentId);
  assertProductMode(req.auth!.productMode, "CMS");

  const body = confirmBody.parse(req.body);
  res.json({ data: await confirmCheckout(tenantId, id, body) });
}

export async function razorpayWebhookController(req: Request, res: Response) {
  const signature = req.header("x-razorpay-signature") ?? "";
  const rawBody = req.body as Buffer;
  const result = await handleRazorpayWebhook(rawBody, signature);
  res.json({ data: result });
}
