import {
  DiscountType,
  FeeFineType,
  PaymentMode,
} from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  assignFeeMaster,
  carryForwardPreviousDues,
  collectPayment,
  createFeeDiscount,
  createFeeGroup,
  createFeeMaster,
  createFeeType,
  createReceiptBook,
  deleteFeeDiscount,
  deleteFeeGroup,
  deleteFeeMaster,
  deleteFeeType,
  deleteReceiptBook,
  getFeeSetup,
  getFeeSummary,
  listStudentFees,
  revertPayment,
  searchPayments,
  updateAssignmentDiscount,
  updateFeeDiscount,
  updateFeeGroup,
  updateFeeMaster,
  updateFeeReminder,
  updateFeeType,
  updateReceiptBook,
} from "./fees.service.js";

const idParams = z.object({ id: z.string().min(1) });
const feeTypeBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});
const feeTypeUpdateBody = feeTypeBody.partial().extend({
  isActive: z.boolean().optional(),
});
const feeGroupBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  feeTypeIds: z.array(z.string().min(1)).min(1),
});
const feeGroupUpdateBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  feeTypeIds: z.array(z.string().min(1)).min(1).optional(),
});
const discountBody = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).nullable().optional(),
  category: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  type: z.nativeEnum(DiscountType),
  value: z.coerce.number().positive(),
});
const discountUpdateBody = discountBody.partial().extend({
  isActive: z.boolean().optional(),
});
const receiptBookBody = z.object({
  name: z.string().trim().min(1).max(100),
  prefix: z.string().trim().min(1).max(20),
  isDefault: z.boolean().default(false),
});
const receiptBookUpdateBody = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  prefix: z.string().trim().min(1).max(20).optional(),
  isDefault: z.boolean().optional(),
});
const feeMasterBody = z.object({
  academicSessionId: z.string().min(1),
  classSectionId: z.string().min(1).nullable().optional(),
  feeGroupId: z.string().min(1),
  feeTypeId: z.string().min(1),
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
  fineType: z.nativeEnum(FeeFineType).default(FeeFineType.NONE),
  fineValue: z.coerce.number().min(0).default(0),
  graceDays: z.coerce.number().int().min(0).max(365).default(0),
  isCustom: z.boolean().default(false),
});
const feeMasterUpdateBody = feeMasterBody.partial();
const assignmentBody = z.object({
  enrollmentIds: z.array(z.string().min(1)).min(1).optional(),
});
const discountAssignmentBody = z.object({
  discountId: z.string().min(1).nullable(),
});
const studentFeeQuery = z.object({
  sessionId: z.string().min(1).optional(),
  asOf: z.coerce.date().optional(),
});
const paymentBody = z.object({
  studentId: z.string().min(1),
  academicSessionId: z.string().min(1),
  receiptBookId: z.string().min(1).optional(),
  paymentDate: z.coerce.date(),
  paymentMode: z.nativeEnum(PaymentMode),
  note: z.string().trim().max(1000).nullable().optional(),
  items: z.array(z.object({
    assignmentId: z.string().min(1),
    amount: z.coerce.number().positive(),
  })).min(1),
});
const paymentSearchQuery = z.object({ query: z.string().trim().max(100).optional() });
const revertBody = z.object({ reason: z.string().trim().min(3).max(1000) });
const summaryQuery = z.object({
  sessionId: z.string().min(1),
  asOf: z.coerce.date().optional(),
});
const reminderBody = z.object({
  autoReminder: z.boolean(),
  reminderDaysBefore: z.coerce.number().int().min(0).max(90),
  reminderDaysAfter: z.coerce.number().int().min(0).max(90),
});
const carryForwardBody = z.object({
  fromSessionId: z.string().min(1),
  targetEnrollmentId: z.string().min(1),
  dueDate: z.coerce.date(),
  asOf: z.coerce.date().optional(),
});

export async function getFeeSetupController(req: Request, res: Response) {
  res.json({ data: await getFeeSetup(req.auth!.tenantId!) });
}

export async function createFeeTypeController(req: Request, res: Response) {
  res.status(201).json({
    data: await createFeeType(req.auth!.tenantId!, feeTypeBody.parse(req.body)),
  });
}

export async function updateFeeTypeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateFeeType(req.auth!.tenantId!, id, feeTypeUpdateBody.parse(req.body)),
  });
}

export async function deleteFeeTypeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const data = await deleteFeeType(req.auth!.tenantId!, id);
  if ("deleted" in data && data.deleted) {
    res.status(204).send();
    return;
  }
  res.json({ data });
}

export async function createFeeGroupController(req: Request, res: Response) {
  res.status(201).json({
    data: await createFeeGroup(req.auth!.tenantId!, feeGroupBody.parse(req.body)),
  });
}

export async function updateFeeGroupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateFeeGroup(req.auth!.tenantId!, id, feeGroupUpdateBody.parse(req.body)),
  });
}

export async function deleteFeeGroupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteFeeGroup(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function createFeeDiscountController(req: Request, res: Response) {
  res.status(201).json({
    data: await createFeeDiscount(req.auth!.tenantId!, discountBody.parse(req.body)),
  });
}

export async function updateFeeDiscountController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateFeeDiscount(req.auth!.tenantId!, id, discountUpdateBody.parse(req.body)),
  });
}

export async function deleteFeeDiscountController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const data = await deleteFeeDiscount(req.auth!.tenantId!, id);
  if ("deleted" in data && data.deleted) {
    res.status(204).send();
    return;
  }
  res.json({ data });
}

export async function createReceiptBookController(req: Request, res: Response) {
  res.status(201).json({
    data: await createReceiptBook(req.auth!.tenantId!, receiptBookBody.parse(req.body)),
  });
}

export async function updateReceiptBookController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateReceiptBook(req.auth!.tenantId!, id, receiptBookUpdateBody.parse(req.body)),
  });
}

export async function deleteReceiptBookController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteReceiptBook(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function createFeeMasterController(req: Request, res: Response) {
  res.status(201).json({
    data: await createFeeMaster(req.auth!.tenantId!, feeMasterBody.parse(req.body)),
  });
}

export async function updateFeeMasterController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateFeeMaster(req.auth!.tenantId!, id, feeMasterUpdateBody.parse(req.body)),
  });
}

export async function deleteFeeMasterController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteFeeMaster(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function assignFeeMasterController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { enrollmentIds } = assignmentBody.parse(req.body);
  res.json({ data: await assignFeeMaster(req.auth!.tenantId!, id, enrollmentIds) });
}

export async function updateAssignmentDiscountController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { discountId } = discountAssignmentBody.parse(req.body);
  res.json({
    data: await updateAssignmentDiscount(req.auth!.tenantId!, id, discountId),
  });
}

export async function listStudentFeesController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { sessionId, asOf } = studentFeeQuery.parse(req.query);
  res.json({
    data: await listStudentFees(req.auth!.tenantId!, id, sessionId, asOf),
  });
}

export async function collectPaymentController(req: Request, res: Response) {
  const data = await collectPayment(
    req.auth!.tenantId!,
    req.auth!.userId,
    paymentBody.parse(req.body),
  );
  res.status(201).json({ data });
}

export async function searchPaymentsController(req: Request, res: Response) {
  const { query } = paymentSearchQuery.parse(req.query);
  res.json({ data: await searchPayments(req.auth!.tenantId!, query) });
}

export async function revertPaymentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { reason } = revertBody.parse(req.body);
  res.json({ data: await revertPayment(req.auth!.tenantId!, id, reason) });
}

export async function getFeeSummaryController(req: Request, res: Response) {
  const { sessionId, asOf } = summaryQuery.parse(req.query);
  res.json({
    data: await getFeeSummary(req.auth!.tenantId!, sessionId, asOf),
  });
}

export async function updateFeeReminderController(req: Request, res: Response) {
  res.json({
    data: await updateFeeReminder(req.auth!.tenantId!, reminderBody.parse(req.body)),
  });
}

export async function carryForwardPreviousDuesController(req: Request, res: Response) {
  res.status(201).json({
    data: await carryForwardPreviousDues(
      req.auth!.tenantId!,
      carryForwardBody.parse(req.body),
    ),
  });
}
