import type { Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export type TransportRouteInput = {
  name: string;
  code?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  stops?: Prisma.InputJsonValue | null;
  fareAmount?: number | null;
  isActive?: boolean;
  notes?: string | null;
};

function routeInclude() {
  return {
    _count: { select: { students: true } },
  } as const;
}

export async function listTransportRoutes(tenantId: string) {
  return prisma.transportRoute.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: routeInclude(),
  });
}

export async function createTransportRoute(tenantId: string, input: TransportRouteInput) {
  return prisma.transportRoute.create({
    data: {
      tenantId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      vehicleNumber: input.vehicleNumber?.trim() || null,
      driverName: input.driverName?.trim() || null,
      driverPhone: input.driverPhone?.trim() || null,
      stops: input.stops ?? undefined,
      fareAmount: input.fareAmount ?? null,
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: routeInclude(),
  });
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
      ...(input.stops !== undefined ? { stops: input.stops ?? undefined } : {}),
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

  return route;
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
    },
  });
  await prisma.transportRoute.delete({ where: { id } });
}

export async function listRouteStudents(tenantId: string, routeId: string) {
  const route = await prisma.transportRoute.findFirst({
    where: tenantScope(tenantId, { id: routeId }),
    select: { id: true, name: true },
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
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return { route, students };
}

export async function assignStudentToRoute(
  tenantId: string,
  studentId: string,
  routeId: string | null,
) {
  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: studentId }),
    select: { id: true },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");

  if (!routeId) {
    return prisma.student.update({
      where: { id: studentId },
      data: {
        transportOptIn: false,
        transportRouteId: null,
        transportRoute: null,
      },
      select: {
        id: true,
        transportOptIn: true,
        transportRouteId: true,
        transportRoute: true,
      },
    });
  }

  const route = await prisma.transportRoute.findFirst({
    where: tenantScope(tenantId, { id: routeId, isActive: true }),
    select: { id: true, name: true },
  });
  if (!route) throw new AppError(404, "Transport route not found", "TRANSPORT_ROUTE_NOT_FOUND");

  return prisma.student.update({
    where: { id: studentId },
    data: {
      transportOptIn: true,
      transportRouteId: route.id,
      transportRoute: route.name,
    },
    select: {
      id: true,
      transportOptIn: true,
      transportRouteId: true,
      transportRoute: true,
    },
  });
}
