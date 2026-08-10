import type { Request, Response } from "express";
import { z } from "zod";
import {
  deleteLibraryMemberType,
  deleteLibrarySettingsCategory,
  getLibrarySettingsSetup,
  previewNextBarcode,
  saveLibrarySettings,
  upsertLibraryMemberType,
  upsertLibrarySettingsCategory,
} from "./library-settings.service.js";

const settingsBody = z.object({
  moduleEnabled: z.boolean().optional(),
  libraryName: z.string().trim().max(160).optional(),
  accessionPrefix: z.string().trim().max(40).optional(),
  defaultIssuePeriodDays: z.coerce.number().int().min(1).max(365).optional(),
  allowRenewals: z.boolean().optional(),
  maxBooksPerMember: z.coerce.number().int().min(1).max(100).optional(),
  maxRenewalsPerBook: z.coerce.number().int().min(0).max(20).optional(),
  reservationValidityDays: z.coerce.number().int().min(0).max(60).optional(),
  returnGracePeriodDays: z.coerce.number().int().min(0).max(30).optional(),
  fineType: z.enum(["PER_DAY", "FLAT"]).optional(),
  fineAmount: z.coerce.number().min(0).optional(),
  maxFinePerBook: z.coerce.number().min(0).optional(),
  processingFee: z.coerce.number().min(0).optional(),
  enableReservations: z.boolean().optional(),
  dueDateReminders: z.boolean().optional(),
  notifyOnOverdue: z.boolean().optional(),
  allowFineExemptions: z.boolean().optional(),
  autoCalculateFine: z.boolean().optional(),
  showAvailabilityToStudents: z.boolean().optional(),
  allowMemberSelfRegistration: z.boolean().optional(),
  barcodeType: z.enum(["CODE128", "CODE39", "EAN13", "QR"]).optional(),
  barcodePrefix: z.string().trim().max(20).optional(),
  barcodeStartingNumber: z.coerce.number().int().min(1).max(999999).optional(),
});

const memberBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().max(20).optional(),
  maxBooks: z.coerce.number().int().min(1).max(100).optional(),
  issuePeriodDays: z.coerce.number().int().min(1).max(365).optional(),
  maxRenewals: z.coerce.number().int().min(0).max(20).optional(),
  finePerDay: z.coerce.number().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const categoryBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  parentId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

const idParams = z.object({ id: z.string().min(1) });

export async function getLibrarySettingsSetupController(req: Request, res: Response) {
  res.json({ data: await getLibrarySettingsSetup(req.auth!.tenantId!) });
}

export async function saveLibrarySettingsController(req: Request, res: Response) {
  res.json({
    data: await saveLibrarySettings(req.auth!.tenantId!, settingsBody.parse(req.body)),
  });
}

export async function upsertLibraryMemberTypeController(req: Request, res: Response) {
  res.json({
    data: await upsertLibraryMemberType(req.auth!.tenantId!, memberBody.parse(req.body)),
  });
}

export async function deleteLibraryMemberTypeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteLibraryMemberType(req.auth!.tenantId!, id) });
}

export async function upsertLibrarySettingsCategoryController(req: Request, res: Response) {
  res.json({
    data: await upsertLibrarySettingsCategory(req.auth!.tenantId!, categoryBody.parse(req.body)),
  });
}

export async function deleteLibrarySettingsCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteLibrarySettingsCategory(req.auth!.tenantId!, id) });
}

export async function previewLibraryBarcodeController(req: Request, res: Response) {
  const setup = await getLibrarySettingsSetup(req.auth!.tenantId!);
  res.json({
    data: {
      preview: previewNextBarcode(
        setup.settings.barcodePrefix,
        setup.settings.barcodeStartingNumber,
      ),
      barcodeType: setup.settings.barcodeType,
    },
  });
}
