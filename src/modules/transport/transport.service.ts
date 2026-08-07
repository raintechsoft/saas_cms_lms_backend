import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type TransportStop = {
  name: string;
  sequence?: number;
  fare?: number | null;
  pickupTime?: string | null;
  dropTime?: string | null;
};

export type TransportRouteInput = {
  name: string;
  code?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  stops?: TransportStop[] | PrismaTypes.InputJsonValue | null;
  fareAmount?: number | null;
  isActive?: boolean;
  notes?: string | null;
};

function routeInclude() {
  return {
    _count: { select: { students: true } },
  } as const;
}

export function normalizeStops(raw: unknown): TransportStop[] {
  if (!Array.isArray(raw)) return [];
  const stops: TransportStop[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    const sequence =
      typeof row.sequence === "number" && Number.isFinite(row.sequence)
        ? row.sequence
        : index + 1;
    const fare =
      row.fare == null || row.fare === ""
        ? null
        : Number(row.fare);
    const pickupTime =
      typeof row.pickupTime === "string" && row.pickupTime.trim() ? row.pickupTime.trim() : null;
    const dropTime =
      typeof row.dropTime === "string" && row.dropTime.trim() ? row.dropTime.trim() : null;
    stops.push({
      name,
      sequence,
      fare: fare != null && Number.isFinite(fare) ? fare : null,
      pickupTime,
      dropTime,
    });
  }
  return stops.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

export async function listTransportRoutes(tenantId: string) {
  const routes = await prisma.transportRoute.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: routeInclude(),
  });
  return routes.map((route) => ({
    ...route,
    stops: normalizeStops(route.stops),
  }));
}

export async function createTransportRoute(tenantId: string, input: TransportRouteInput) {
  const stops = normalizeStops(input.stops);
  const route = await prisma.transportRoute.create({
    data: {
      tenantId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      vehicleNumber: input.vehicleNumber?.trim() || null,
      driverName: input.driverName?.trim() || null,
      driverPhone: input.driverPhone?.trim() || null,
      stops: stops.length ? stops : undefined,
      fareAmount: input.fareAmount ?? null,
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: routeInclude(),
  });
  return { ...route, stops: normalizeStops(route.stops) };
}

export async function updateTransportRoute(
  tenantId: string,
  id: string,
  input: Partial<TransportRouteInput>,
) {
  const found = await prisma.transportRoute.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true, name: true },
  });
  if (!found) throw new AppError(404, "Transport route not found", "TRANSPORT_ROUTE_NOT_FOUND");

  const stops =
    input.stops !== undefined ? normalizeStops(input.stops) : undefined;

  const route = await prisma.transportRoute.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.code !== undefined ? { code: input.code?.trim() || null } : {}),
      ...(input.vehicleNumber !== undefined
        ? { vehicleNumber: input.vehicleNumber?.trim() || null }
        : {}),
      ...(input.driverName !== undefined ? { driverName: input.driverName?.trim() || null } : {}),
      ...(input.driverPhone !== undefined
        ? { driverPhone: input.driverPhone?.trim() || null }
        : {}),
      ...(stops !== undefined ? { stops: stops.length ? stops : Prisma.DbNull } : {}),
      ...(input.fareAmount !== undefined ? { fareAmount: input.fareAmount ?? null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: routeInclude(),
  });

  if (input.name !== undefined && input.name.trim() !== found.name) {
    await prisma.student.updateMany({
      where: tenantScope(tenantId, { transportRouteId: id }),
      data: { transportRoute: route.name },
    });
  }

  return { ...route, stops: normalizeStops(route.stops) };
}

export async function deleteTransportRoute(tenantId: string, id: string) {
  const found = await prisma.transportRoute.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Transport route not found", "TRANSPORT_ROUTE_NOT_FOUND");

  await prisma.student.updateMany({
    where: tenantScope(tenantId, { transportRouteId: id }),
    data: {
      transportOptIn: false,
      transportRouteId: null,
      transportRoute: null,
      transportStopName: null,
    },
  });
  await prisma.transportRoute.delete({ where: { id } });
}

export async function listRouteStudents(tenantId: string, routeId: string) {
  const route = await prisma.transportRoute.findFirst({
    where: tenantScope(tenantId, { id: routeId }),
    select: {
      id: true,
      name: true,
      vehicleNumber: true,
      driverName: true,
      driverPhone: true,
      stops: true,
      fareAmount: true,
    },
  });
  if (!route) throw new AppError(404, "Transport route not found", "TRANSPORT_ROUTE_NOT_FOUND");

  const students = await prisma.student.findMany({
    where: tenantScope(tenantId, { transportRouteId: routeId }),
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      transportOptIn: true,
      transportRoute: true,
      transportStopName: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return { route: { ...route, stops: normalizeStops(route.stops) }, students };
}

export async function listTransportAssignmentLogs(
  tenantId: string,
  query?: { studentId?: string; routeId?: string; take?: number },
) {
  return prisma.transportAssignmentLog.findMany({
    where: tenantScope(tenantId, {
      ...(query?.studentId ? { studentId: query.studentId } : {}),
      ...(query?.routeId ? { transportRouteId: query.routeId } : {}),
    }),
    include: {
      student: {
        select: { id: true, admissionNumber: true, firstName: true, lastName: true },
      },
      transportRoute: { select: { id: true, name: true } },
      assignedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: query?.take ?? 100,
  });
}

export async function assignStudentToRoute(
  tenantId: string,
  studentId: string,
  routeId: string | null,
  options?: { stopName?: string | null; assignedById?: string | null; note?: string | null },
) {
  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: studentId }),
    select: { id: true, transportRouteId: true, transportStopName: true },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");

  if (!routeId) {
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        transportOptIn: false,
        transportRouteId: null,
        transportRoute: null,
        transportStopName: null,
      },
      select: {
        id: true,
        transportOptIn: true,
        transportRouteId: true,
        transportRoute: true,
        transportStopName: true,
      },
    });
    await prisma.transportAssignmentLog.create({
      data: {
        tenantId,
        studentId,
        transportRouteId: student.transportRouteId,
        stopName: student.transportStopName,
        action: "CLEARED",
        note: options?.note?.trim() || null,
        assignedById: options?.assignedById || null,
      },
    });
    return updated;
  }

  const route = await prisma.transportRoute.findFirst({
    where: tenantScope(tenantId, { id: routeId, isActive: true }),
    select: { id: true, name: true, stops: true },
  });
  if (!route) throw new AppError(404, "Transport route not found", "TRANSPORT_ROUTE_NOT_FOUND");

  const stops = normalizeStops(route.stops);
  const stopName = options?.stopName?.trim() || null;
  if (stopName && stops.length && !stops.some((s) => s.name === stopName)) {
    throw new AppError(400, "Stop is not on this route", "TRANSPORT_STOP_INVALID");
  }

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: {
      transportOptIn: true,
      transportRouteId: route.id,
      transportRoute: route.name,
      transportStopName: stopName,
    },
    select: {
      id: true,
      transportOptIn: true,
      transportRouteId: true,
      transportRoute: true,
      transportStopName: true,
    },
  });

  await prisma.transportAssignmentLog.create({
    data: {
      tenantId,
      studentId,
      transportRouteId: route.id,
      stopName,
      action: student.transportRouteId === route.id ? "UPDATED" : "ASSIGNED",
      note: options?.note?.trim() || null,
      assignedById: options?.assignedById || null,
    },
  });

  return updated;
}
