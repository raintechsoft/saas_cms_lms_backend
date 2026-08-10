import { AdjustmentType } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createPayComponent,
  deletePayComponent,
  getPayrollSettingsSetup,
  updatePayComponent,
  updatePayrollSettings,
} from "./payroll-settings.service.js";

const idParams = z.object({ id: z.string().min(1) });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));

const settingsBody = z.object({
  payrollFrequency: z.string().trim().min(1).max(40).optional(),
  financialYear: z.string().trim().min(1).max(20).optional(),
  payDay: z.coerce.number().int().min(1).max(31).optional(),
  paymentMethod: z.string().trim().min(1).max(40).optional(),
  salaryCalculationMethod: z.string().trim().min(1).max(40).optional(),
  roundingOff: z.string().trim().min(1).max(40).optional(),
  incomeTaxCalculation: z.string().trim().min(1).max(40).optional(),
  arrearCalculation: z.boolean().optional(),
  autoRecalculate: z.boolean().optional(),
  generatePayslip: z.boolean().optional(),
  emailPayslip: z.boolean().optional(),
  lockPayrollAfterApproval: z.boolean().optional(),
  pfScheme: z.string().trim().min(1).max(40).optional(),
  esiApplicability: z.string().trim().min(1).max(40).optional(),
  epfNumber: optionalText(60),
  esiNumber: optionalText(60),
  professionalTax: z.string().trim().min(1).max(40).optional(),
  labourWelfareFund: z.string().trim().min(1).max(40).optional(),
  payStructure: z.string().trim().min(1).max(40).optional(),
  allowNegativeSalary: z.boolean().optional(),
  minimumPayLimit: z.coerce.number().min(0).optional(),
  maximumPayLimit: z.coerce.number().min(0).optional(),
  overtimeCalculation: z.string().trim().min(1).max(40).optional(),
  leaveEncashment: z.string().trim().min(1).max(40).optional(),
  preparedByRole: z.string().trim().min(1).max(80).optional(),
  reviewedByRole: z.string().trim().min(1).max(80).optional(),
  approvedByRole: z.string().trim().min(1).max(80).optional(),
});

const componentBody = z.object({
  name: z.string().trim().min(1).max(100),
  shortCode: z.string().trim().max(20).nullable().optional(),
  type: z.nativeEnum(AdjustmentType),
  taxable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  defaultAmount: z.coerce.number().min(0).optional(),
});

export async function getPayrollSettingsSetupController(req: Request, res: Response) {
  res.json({ data: await getPayrollSettingsSetup(req.auth!.tenantId!) });
}

export async function updatePayrollSettingsController(req: Request, res: Response) {
  res.json({
    data: await updatePayrollSettings(req.auth!.tenantId!, settingsBody.parse(req.body)),
  });
}

export async function createPayComponentController(req: Request, res: Response) {
  res.status(201).json({
    data: await createPayComponent(req.auth!.tenantId!, componentBody.parse(req.body)),
  });
}

export async function updatePayComponentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updatePayComponent(
      req.auth!.tenantId!,
      id,
      componentBody.partial().parse(req.body),
    ),
  });
}

export async function deletePayComponentController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deletePayComponent(req.auth!.tenantId!, id) });
}
