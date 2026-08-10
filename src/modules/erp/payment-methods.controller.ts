import type { Request, Response } from "express";
import { z } from "zod";
import {
  deletePaymentMethodSetup,
  getPaymentMethodsSetup,
  togglePaymentMethodSetup,
  upsertPaymentMethodSetup,
} from "./payment-methods.service.js";

const idParams = z.object({ id: z.string().min(1) });

const methodBody = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1).max(120),
  displayName: z.string().trim().max(160).optional(),
  description: z.string().trim().max(500).optional(),
  methodType: z.enum(["ONLINE", "OFFLINE"]).optional(),
  provider: z.string().trim().max(40).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  modes: z
    .object({
      cards: z.boolean().optional(),
      upi: z.boolean().optional(),
      netbanking: z.boolean().optional(),
      wallets: z.boolean().optional(),
      emi: z.boolean().optional(),
    })
    .optional(),
  enableForFees: z.boolean().optional(),
  enableForAdmission: z.boolean().optional(),
  enableForMisc: z.boolean().optional(),
  enableForRefunds: z.boolean().optional(),
  showInPortal: z.boolean().optional(),
  apiKey: z.string().trim().max(4000).optional(),
  apiSecret: z.string().trim().max(4000).optional(),
  webhookSecret: z.string().trim().max(4000).optional(),
});

const toggleBody = z.object({
  isActive: z.boolean().optional(),
});

export async function getPaymentMethodsSetupController(req: Request, res: Response) {
  res.json({ data: await getPaymentMethodsSetup(req.auth!.tenantId!) });
}

export async function upsertPaymentMethodSetupController(req: Request, res: Response) {
  res.json({
    data: await upsertPaymentMethodSetup(req.auth!.tenantId!, methodBody.parse(req.body)),
  });
}

export async function togglePaymentMethodSetupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = toggleBody.parse(req.body ?? {});
  res.json({
    data: await togglePaymentMethodSetup(req.auth!.tenantId!, id, body.isActive),
  });
}

export async function deletePaymentMethodSetupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deletePaymentMethodSetup(req.auth!.tenantId!, id) });
}
