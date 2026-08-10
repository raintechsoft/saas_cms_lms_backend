import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  assignStudentToRoute,
  createTransportRoute,
  deleteTransportRoute,
  listRouteStudents,
  listTransportAssignmentLogs,
  listTransportRoutes,
  normalizeStops,
  updateTransportRoute,
} from "./transport.service.js";

const idParams = z.object({ id: z.string().min(1) });

const stopSchema = z.object({
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(200).nullable().optional(),
  sequence: z.coerce.number().int().min(0).optional(),
  fare: z.coerce.number().min(0).nullable().optional(),
  pickupTime: z.string().trim().max(20).nullable().optional(),
  dropTime: z.string().trim().max(20).nullable().optional(),
});

const routeBody = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(40).nullable().optional(),
  vehicleNumber: z.string().trim().max(40).nullable().optional(),
  driverName: z.string().trim().max(120).nullable().optional(),
  driverPhone: z.string().trim().max(30).nullable().optional(),
  attendantName: z.string().trim().max(120).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
  stops: z.array(stopSchema).nullable().optional(),
  fareAmount: z.coerce.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const assignBody = z.object({
  studentId: z.string().min(1),
  routeId: z.string().min(1).nullable(),
  stopName: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

const logsQuery = z.object({
  studentId: z.string().min(1).optional(),
  routeId: z.string().min(1).optional(),
  take: z.coerce.number().int().positive().max(200).optional(),
});

export async function listTransportRoutesController(req: Request, res: Response) {
  res.json({ data: await listTransportRoutes(req.auth!.tenantId!) });
}

export async function createTransportRouteController(req: Request, res: Response) {
  const body = routeBody.parse(req.body);
  res.status(201).json({
    data: await createTransportRoute(req.auth!.tenantId!, {
      ...body,
      stops: body.stops ? normalizeStops(body.stops) : body.stops,
    }),
  });
}

export async function updateTransportRouteController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = routeBody.partial().parse(req.body);
  if (body.name !== undefined && !body.name.trim()) {
    throw new AppError(400, "Route name is required", "TRANSPORT_ROUTE_NAME_REQUIRED");
  }
  res.json({
    data: await updateTransportRoute(req.auth!.tenantId!, id, {
      ...body,
      stops: body.stops !== undefined ? normalizeStops(body.stops) : undefined,
    }),
  });
}

export async function deleteTransportRouteController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteTransportRoute(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listRouteStudentsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await listRouteStudents(req.auth!.tenantId!, id) });
}

export async function listTransportLogsController(req: Request, res: Response) {
  const query = logsQuery.parse(req.query);
  res.json({
    data: await listTransportAssignmentLogs(req.auth!.tenantId!, query),
  });
}

export async function assignTransportStudentController(req: Request, res: Response) {
  const body = assignBody.parse(req.body);
  res.json({
    data: await assignStudentToRoute(req.auth!.tenantId!, body.studentId, body.routeId, {
      stopName: body.stopName,
      note: body.note,
      assignedById: req.auth!.userId,
    }),
  });
}
