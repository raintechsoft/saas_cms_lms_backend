import type {
  Prisma,
  TransportFeeCollectionMode,
  TransportFeeType,
  TransportVehicleStatus,
  TransportWindowUnit,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import {
  createTransportRoute,
  deleteTransportRoute,
  listTransportRoutes,
  normalizeStops,
  updateTransportRoute,
  type TransportRouteInput,
  type TransportStop,
} from "../transport/transport.service.js";

async function ensureSettings(tenantId: string) {
  const existing = await prisma.tenantTransportSetting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.tenantTransportSetting.create({ data: { tenantId } });
}

async function ensureDemoTransport(tenantId: string) {
  const routeCount = await prisma.transportRoute.count({ where: { tenantId } });
  if (routeCount === 0) {
    const seeds: Array<{
      name: string;
      code: string;
      color: string;
      driverName: string;
      attendantName: string;
      vehicleNumber: string;
      stops: TransportStop[];
    }> = [
      {
        name: "Green Valley",
        code: "RT01",
        color: "#10B981",
        driverName: "Rahul Singh",
        attendantName: "Suresh Kumar",
        vehicleNumber: "KA 01 AB 1234",
        stops: [
          {
            name: "Green Valley Circle",
            location: "Green Valley, Block A",
            pickupTime: "07:00 AM",
            dropTime: "02:45 PM",
            sequence: 1,
          },
          {
            name: "City Hospital",
            location: "MG Road",
            pickupTime: "07:15 AM",
            dropTime: "02:30 PM",
            sequence: 2,
          },
          {
            name: "Sunrise Apartments",
            location: "Sector 12",
            pickupTime: "07:30 AM",
            dropTime: "02:15 PM",
            sequence: 3,
          },
        ],
      },
      {
        name: "Silver City",
        code: "RT02",
        color: "#F59E0B",
        driverName: "Amit Verma",
        attendantName: "Ravi Patel",
        vehicleNumber: "KA 01 CD 5678",
        stops: [
          {
            name: "Silver City Gate",
            location: "Silver City Phase 1",
            pickupTime: "07:05 AM",
            dropTime: "02:40 PM",
            sequence: 1,
          },
          {
            name: "Metro Station",
            location: "Central Metro",
            pickupTime: "07:20 AM",
            dropTime: "02:25 PM",
            sequence: 2,
          },
        ],
      },
      {
        name: "Lake View",
        code: "RT03",
        color: "#3B82F6",
        driverName: "Vikram Rao",
        attendantName: "Anil Das",
        vehicleNumber: "KA 05 EF 9012",
        stops: [
          {
            name: "Lake View Park",
            location: "Lake Road",
            pickupTime: "07:10 AM",
            dropTime: "02:35 PM",
            sequence: 1,
          },
        ],
      },
      {
        name: "Tech Park",
        code: "RT04",
        color: "#8B5CF6",
        driverName: "Imran Khan",
        attendantName: "Deepak Nair",
        vehicleNumber: "KA 03 GH 3456",
        stops: [
          {
            name: "Tech Park Main",
            location: "IT Corridor",
            pickupTime: "06:55 AM",
            dropTime: "02:50 PM",
            sequence: 1,
          },
          {
            name: "Library Junction",
            location: "College Road",
            pickupTime: "07:12 AM",
            dropTime: "02:32 PM",
            sequence: 2,
          },
        ],
      },
      {
        name: "Old Town",
        code: "RT05",
        color: "#EF4444",
        driverName: "Sanjay Mehta",
        attendantName: "Kiran Joshi",
        vehicleNumber: "",
        stops: [
          {
            name: "Town Square",
            location: "Old Town Market",
            pickupTime: "07:25 AM",
            dropTime: "02:20 PM",
            sequence: 1,
          },
        ],
      },
    ];

    for (const item of seeds) {
      await prisma.transportRoute.create({
        data: {
          tenantId,
          name: item.name,
          code: item.code,
          color: item.color,
          driverName: item.driverName,
          attendantName: item.attendantName,
          vehicleNumber: item.vehicleNumber || null,
          stops: item.stops,
          isActive: true,
        },
      });
    }
  }

  const vehicleCount = await prisma.transportVehicle.count({ where: { tenantId } });
  if (vehicleCount === 0) {
    const routes = await prisma.transportRoute.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
      take: 4,
    });
    const vehicles = [
      {
        registrationNo: "KA 01 AB 1234",
        label: "Bus - 1",
        capacity: 44,
        status: "ACTIVE" as TransportVehicleStatus,
      },
      {
        registrationNo: "KA 01 CD 5678",
        label: "Bus - 2",
        capacity: 40,
        status: "ACTIVE" as TransportVehicleStatus,
      },
      {
        registrationNo: "KA 05 EF 9012",
        label: "Mini Bus - 1",
        capacity: 28,
        status: "MAINTENANCE" as TransportVehicleStatus,
      },
      {
        registrationNo: "KA 03 GH 3456",
        label: "Bus - 3",
        capacity: 44,
        status: "INACTIVE" as TransportVehicleStatus,
      },
    ];
    await prisma.transportVehicle.createMany({
      data: vehicles.map((v, index) => ({
        tenantId,
        registrationNo: v.registrationNo,
        label: v.label,
        vehicleType: "Bus",
        capacity: v.capacity,
        status: v.status,
        routeId: routes[index]?.id || null,
      })),
    });
  }
}

function mapSettings(row: {
  moduleEnabled: boolean;
  pickupWindowValue: string;
  pickupWindowUnit: TransportWindowUnit;
  dropWindowValue: string;
  dropWindowUnit: TransportWindowUnit;
  allowParentTracking: boolean;
  feeType: TransportFeeType;
  feeCollectionMode: TransportFeeCollectionMode;
  feeDueDay: number;
  lateFeeAmount: { toString(): string } | number;
  markAttendanceOnPickup: boolean;
  markAttendanceOnDrop: boolean;
  notifyParentOnPickupDrop: boolean;
}) {
  return {
    moduleEnabled: row.moduleEnabled,
    pickupWindowValue: row.pickupWindowValue,
    pickupWindowUnit: row.pickupWindowUnit,
    dropWindowValue: row.dropWindowValue,
    dropWindowUnit: row.dropWindowUnit,
    allowParentTracking: row.allowParentTracking,
    feeType: row.feeType,
    feeCollectionMode: row.feeCollectionMode,
    feeDueDay: row.feeDueDay,
    lateFeeAmount: Number(row.lateFeeAmount),
    markAttendanceOnPickup: row.markAttendanceOnPickup,
    markAttendanceOnDrop: row.markAttendanceOnDrop,
    notifyParentOnPickupDrop: row.notifyParentOnPickupDrop,
  };
}

export async function getTransportSettingsSetup(tenantId: string) {
  const settings = await ensureSettings(tenantId);
  await ensureDemoTransport(tenantId);

  const [routes, vehicles, studentsOnTransport, staff] = await Promise.all([
    listTransportRoutes(tenantId),
    prisma.transportVehicle.findMany({
      where: { tenantId },
      orderBy: { registrationNo: "asc" },
      include: { route: { select: { id: true, name: true, code: true } } },
    }),
    prisma.student.count({
      where: { tenantId, transportOptIn: true },
    }),
    prisma.staffProfile.findMany({
      where: { tenantId, status: "ACTIVE" },
      take: 50,
      orderBy: { employeeNumber: "asc" },
      select: {
        id: true,
        employeeNumber: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const totalStops = routes.reduce(
    (sum, route) => sum + (Array.isArray(route.stops) ? route.stops.length : 0),
    0,
  );

  return {
    settings: mapSettings(settings),
    routes: routes.map((route, index) => ({
      id: route.id,
      name: route.name,
      code: route.code,
      displayLabel: `Route - ${String(index + 1).padStart(2, "0")}`,
      color: route.color || "#10B981",
      driverName: route.driverName,
      attendantName: route.attendantName,
      vehicleNumber: route.vehicleNumber,
      isActive: route.isActive,
      studentCount: route._count?.students ?? 0,
      stops: normalizeStops(route.stops).map((stop, stopIndex) => ({
        sequence: stop.sequence ?? stopIndex + 1,
        name: stop.name,
        location: stop.location || "—",
        pickupTime: stop.pickupTime || "—",
        dropTime: stop.dropTime || "—",
        fare: stop.fare,
      })),
    })),
    vehicles: vehicles.map((v) => ({
      id: v.id,
      registrationNo: v.registrationNo,
      label: v.label || v.vehicleType,
      vehicleType: v.vehicleType,
      capacity: v.capacity,
      status: v.status,
      statusLabel:
        v.status === "ACTIVE"
          ? "Active"
          : v.status === "MAINTENANCE"
            ? "Maintenance"
            : "Inactive",
      routeId: v.routeId,
      routeName: v.route?.name || null,
    })),
    staffOptions: staff.map((s) => ({
      id: s.id,
      label: `${s.user.firstName} ${s.user.lastName}`.trim() || s.employeeNumber,
    })),
    stats: {
      totalStudents: Math.max(studentsOnTransport, studentsOnTransport === 0 ? 0 : studentsOnTransport),
      totalStudentsDisplay:
        studentsOnTransport > 0 ? studentsOnTransport : Math.max(routes.length * 90, 0),
      totalRoutes: routes.filter((r) => r.isActive).length,
      totalStops,
      totalVehicles: vehicles.length,
    },
    note: "Transport fee and attendance will be applied based on the above configuration.",
  };
}

export type SaveTransportSettingsInput = {
  moduleEnabled?: boolean;
  pickupWindowValue?: string;
  pickupWindowUnit?: TransportWindowUnit;
  dropWindowValue?: string;
  dropWindowUnit?: TransportWindowUnit;
  allowParentTracking?: boolean;
  feeType?: TransportFeeType;
  feeCollectionMode?: TransportFeeCollectionMode;
  feeDueDay?: number;
  lateFeeAmount?: number;
  markAttendanceOnPickup?: boolean;
  markAttendanceOnDrop?: boolean;
  notifyParentOnPickupDrop?: boolean;
};

export async function saveTransportSettings(
  tenantId: string,
  input: SaveTransportSettingsInput,
) {
  await ensureSettings(tenantId);
  if (input.feeDueDay != null && (input.feeDueDay < 1 || input.feeDueDay > 28)) {
    throw new AppError(400, "Fee due day must be between 1 and 28", "FEE_DUE_DAY_INVALID");
  }

  const data: Prisma.TenantTransportSettingUpdateInput = {};
  if (input.moduleEnabled != null) data.moduleEnabled = input.moduleEnabled;
  if (input.pickupWindowValue != null) data.pickupWindowValue = input.pickupWindowValue.trim();
  if (input.pickupWindowUnit != null) data.pickupWindowUnit = input.pickupWindowUnit;
  if (input.dropWindowValue != null) data.dropWindowValue = input.dropWindowValue.trim();
  if (input.dropWindowUnit != null) data.dropWindowUnit = input.dropWindowUnit;
  if (input.allowParentTracking != null) data.allowParentTracking = input.allowParentTracking;
  if (input.feeType != null) data.feeType = input.feeType;
  if (input.feeCollectionMode != null) data.feeCollectionMode = input.feeCollectionMode;
  if (input.feeDueDay != null) data.feeDueDay = input.feeDueDay;
  if (input.lateFeeAmount != null) data.lateFeeAmount = input.lateFeeAmount;
  if (input.markAttendanceOnPickup != null) {
    data.markAttendanceOnPickup = input.markAttendanceOnPickup;
  }
  if (input.markAttendanceOnDrop != null) data.markAttendanceOnDrop = input.markAttendanceOnDrop;
  if (input.notifyParentOnPickupDrop != null) {
    data.notifyParentOnPickupDrop = input.notifyParentOnPickupDrop;
  }

  await prisma.tenantTransportSetting.update({ where: { tenantId }, data });
  return getTransportSettingsSetup(tenantId);
}

export async function upsertTransportSettingsRoute(
  tenantId: string,
  input: TransportRouteInput & { id?: string },
) {
  if (input.id) {
    await updateTransportRoute(tenantId, input.id, input);
  } else {
    await createTransportRoute(tenantId, input);
  }
  return getTransportSettingsSetup(tenantId);
}

export async function deleteTransportSettingsRoute(tenantId: string, id: string) {
  await deleteTransportRoute(tenantId, id);
  return getTransportSettingsSetup(tenantId);
}

export type VehicleInput = {
  registrationNo: string;
  label?: string | null;
  vehicleType?: string;
  capacity?: number;
  status?: TransportVehicleStatus;
  routeId?: string | null;
  notes?: string | null;
};

export async function upsertTransportVehicle(
  tenantId: string,
  input: VehicleInput & { id?: string },
) {
  const registrationNo = input.registrationNo.trim();
  if (!registrationNo) {
    throw new AppError(400, "Registration number is required", "VEHICLE_REG_REQUIRED");
  }
  if (input.routeId) {
    const route = await prisma.transportRoute.findFirst({
      where: tenantScope(tenantId, { id: input.routeId }),
    });
    if (!route) throw new AppError(400, "Route is invalid", "VEHICLE_ROUTE_INVALID");
  }

  if (input.id) {
    const existing = await prisma.transportVehicle.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!existing) throw new AppError(404, "Vehicle not found", "VEHICLE_NOT_FOUND");
    await prisma.transportVehicle.update({
      where: { id: input.id },
      data: {
        registrationNo,
        label: input.label?.trim() || null,
        vehicleType: input.vehicleType?.trim() || "Bus",
        capacity: input.capacity ?? existing.capacity,
        status: input.status ?? existing.status,
        routeId: input.routeId === undefined ? existing.routeId : input.routeId,
        notes: input.notes === undefined ? existing.notes : input.notes?.trim() || null,
      },
    });
  } else {
    await prisma.transportVehicle.create({
      data: {
        tenantId,
        registrationNo,
        label: input.label?.trim() || null,
        vehicleType: input.vehicleType?.trim() || "Bus",
        capacity: input.capacity ?? 40,
        status: input.status ?? "ACTIVE",
        routeId: input.routeId || null,
        notes: input.notes?.trim() || null,
      },
    });
  }

  return getTransportSettingsSetup(tenantId);
}

export async function deleteTransportVehicle(tenantId: string, id: string) {
  const result = await prisma.transportVehicle.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Vehicle not found", "VEHICLE_NOT_FOUND");
  return getTransportSettingsSetup(tenantId);
}
