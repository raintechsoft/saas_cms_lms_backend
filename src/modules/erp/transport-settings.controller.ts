import type { Request, Response } from "express";
import { z } from "zod";
import {
  deleteTransportSettingsRoute,
  deleteTransportVehicle,
  getTransportSettingsSetup,
  saveTransportSettings,
  upsertTransportSettingsRoute,
  upsertTransportVehicle,
} from "./transport-settings.service.js";

const settingsBody = z.object({
  moduleEnabled: z.boolean().optional(),
  pickupWindowValue: z.string().trim().max(20).optional(),
  pickupWindowUnit: z.enum(["HOURS", "MINUTES"]).optional(),
  dropWindowValue: z.string().trim().max(20).optional(),
  dropWindowUnit: z.enum(["HOURS", "MINUTES"]).optional(),
  allowParentTracking: z.boolean().optional(),
  feeType: z.enum(["ANNUAL", "MONTHLY", "QUARTERLY"]).optional(),
  feeCollectionMode: z.enum(["IN_ADVANCE", "IN_ARREARS"]).optional(),
  feeDueDay: z.coerce.number().int().min(1).max(28).optional(),
  lateFeeAmount: z.coerce.number().min(0).optional(),
  markAttendanceOnPickup: z.boolean().optional(),
  markAttendanceOnDrop: z.boolean().optional(),
  notifyParentOnPickupDrop: z.boolean().optional(),
});

const stopSchema = z.object({
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(200).nullable().optional(),
  sequence: z.coerce.number().int().min(0).optional(),
  fare: z.coerce.number().min(0).nullable().optional(),
  pickupTime: z.string().trim().max(20).nullable().optional(),
  dropTime: z.string().trim().max(20).nullable().optional(),
});

const routeBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(40).nullable().optional(),
  vehicleNumber: z.string().trim().max(40).nullable().optional(),
  driverName: z.string().trim().max(120).nullable().optional(),
  driverPhone: z.string().trim().max(30).nullable().optional(),
  attendantName: z.string().trim().max(120).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
  stops: z.array(stopSchema).optional(),
  fareAmount: z.coerce.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const vehicleBody = z.object({
  id: z.string().min(1).optional(),
  registrationNo: z.string().trim().min(1).max(40),
  label: z.string().trim().max(80).nullable().optional(),
  vehicleType: z.string().trim().max(40).optional(),
  capacity: z.coerce.number().int().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]).optional(),
  routeId: z.string().min(1).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const idParams = z.object({ id: z.string().min(1) });

export async function getTransportSettingsSetupController(req: Request, res: Response) {
  res.json({ data: await getTransportSettingsSetup(req.auth!.tenantId!) });
}

export async function saveTransportSettingsController(req: Request, res: Response) {
  res.json({
    data: await saveTransportSettings(req.auth!.tenantId!, settingsBody.parse(req.body)),
  });
}

export async function upsertTransportSettingsRouteController(req: Request, res: Response) {
  res.json({
    data: await upsertTransportSettingsRoute(req.auth!.tenantId!, routeBody.parse(req.body)),
  });
}

export async function deleteTransportSettingsRouteController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteTransportSettingsRoute(req.auth!.tenantId!, id) });
}

export async function upsertTransportVehicleController(req: Request, res: Response) {
  res.json({
    data: await upsertTransportVehicle(req.auth!.tenantId!, vehicleBody.parse(req.body)),
  });
}

export async function deleteTransportVehicleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteTransportVehicle(req.auth!.tenantId!, id) });
}
