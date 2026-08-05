import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  assignStudentToRoute,
  createTransportRoute,
  deleteTransportRoute,
  listRouteStudents,
  listTransportRoutes,
  updateTransportRoute,
} from "./transport.service.js";

const idParams = z.object({ id: z.string().min(1) });

const routeBody = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().max(40).nullable().optional(),
  vehicleNumber: z.string().trim().max(40).nullable().optional(),
  driverName: z.string().trim().max(120).nullable().optional(),
  driverPhone: z.string().trim().max(30).nullable().optional(),
  stops: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
  fareAmount: z.coerce.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const assignBody = z.object({
  studentId: z.string().min(1),
  routeId: z.string().min(1).nullable(),
});

export async function listTransportRoutesController(req: Request, res: Response) {
  res.json({ data: await listTransportRoutes(req.auth!.tenantId!) });
}

export async function createTransportRouteController(req: Request, res: Response) {
  const body = routeBody.parse(req.body);
  res.status(201).json({
    data: await createTransportRoute(req.auth!.tenantId!, {
      ...body,
      stops: body.stops as Prisma.InputJsonValue | null | undefined,
    }),
  });
}

export async function updateTransportRouteController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = routeBody.partial().parse(req.body);
  res.json({
    data: await updateTransportRoute(req.auth!.tenantId!, id, {
      ...body,
      stops: body.stops as Prisma.InputJsonValue | null | undefined,
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

export async function assignTransportStudentController(req: Request, res: Response) {
  const body = assignBody.parse(req.body);
  res.json({
    data: await assignStudentToRoute(req.auth!.tenantId!, body.studentId, body.routeId),
  });
}
