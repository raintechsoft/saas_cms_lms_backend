import { HolidayKind } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const DEFAULT_SHIFT = {
  name: "General Shift",
  startTime: "09:00",
  endTime: "18:00",
  isDefault: true,
  isActive: true,
};

async function ensureDefaults(tenantId: string) {
  const shiftCount = await prisma.staffWorkShift.count({ where: { tenantId } });
  if (!shiftCount) {
    await prisma.staffWorkShift.create({
      data: { tenantId, ...DEFAULT_SHIFT },
    });
  }
  const defaultShift = await prisma.staffWorkShift.findFirst({
    where: { tenantId, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  return prisma.tenantStaffAttendanceSetting.upsert({
    where: { tenantId },
    create: {
      tenantId,
      defaultShiftId: defaultShift?.id ?? null,
      workFrom: defaultShift?.startTime ?? "09:00",
      workTo: defaultShift?.endTime ?? "18:00",
    },
    update: {},
  });
}

function mapSettings(row: Awaited<ReturnType<typeof ensureDefaults>>) {
  return {
    moduleEnabled: row.moduleEnabled,
    markingMode: row.markingMode,
    allowManual: row.allowManual,
    allowSelfCheckIn: row.allowSelfCheckIn,
    allowSelfCheckOut: row.allowSelfCheckOut,
    showOfficeLocation: row.showOfficeLocation,
    requireRemarksManual: row.requireRemarksManual,
    halfDayAs: row.halfDayAs,
    colorScheme: row.colorScheme,
    defaultShiftId: row.defaultShiftId,
    workingDays: row.workingDays,
    weeklyOffDays: row.weeklyOffDays,
    workFrom: row.workFrom,
    workTo: row.workTo,
    breakMinutes: row.breakMinutes,
    graceBeforeMinutes: row.graceBeforeMinutes,
    graceAfterMinutes: row.graceAfterMinutes,
    lateAfterMinutes: row.lateAfterMinutes,
    earlyLeavingMinutes: row.earlyLeavingMinutes,
    halfDayAfterMinutes: row.halfDayAfterMinutes,
    overtimeMode: row.overtimeMode,
    minFullDayMinutes: row.minFullDayMinutes,
    markAbsentWeeklyOff: row.markAbsentWeeklyOff,
    markAbsentHoliday: row.markAbsentHoliday,
    autoApplyApprovedLeave: row.autoApplyApprovedLeave,
    autoMarkHoliday: row.autoMarkHoliday,
    leaveDayCounting: row.leaveDayCounting,
    absentMarkingType: row.absentMarkingType,
    cdOnWeeklyOff: row.cdOnWeeklyOff,
    locationTracking: row.locationTracking,
    attendanceRadiusMeters: row.attendanceRadiusMeters,
    allowCheckInOutside: row.allowCheckInOutside,
    allowCheckOutOutside: row.allowCheckOutOutside,
    restrictMultipleLogin: row.restrictMultipleLogin,
    deviceRestriction: row.deviceRestriction,
  };
}

export async function getStaffAttendanceSettingsSetup(tenantId: string) {
  await ensureDefaults(tenantId);
  const [settings, shifts, holidays] = await Promise.all([
    prisma.tenantStaffAttendanceSetting.findUniqueOrThrow({ where: { tenantId } }),
    prisma.staffWorkShift.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.holiday.findMany({
      where: { tenantId },
      orderBy: { startDate: "asc" },
      take: 20,
    }),
  ]);

  return {
    settings: mapSettings(settings),
    shifts,
    holidays: holidays.map((h) => ({
      id: h.id,
      title: h.title,
      startDate: h.startDate,
      endDate: h.endDate,
      kind: h.kind,
      repeatsAnnually: h.repeatsAnnually,
      description: h.description,
    })),
  };
}

export async function updateStaffAttendanceSettings(
  tenantId: string,
  input: Partial<ReturnType<typeof mapSettings>>,
) {
  await ensureDefaults(tenantId);

  if (input.defaultShiftId) {
    const shift = await prisma.staffWorkShift.findFirst({
      where: tenantScope(tenantId, { id: input.defaultShiftId }),
      select: { id: true, startTime: true, endTime: true },
    });
    if (!shift) throw new AppError(400, "Default shift is invalid", "INVALID_SHIFT");
  }

  if (input.moduleEnabled !== undefined) {
    await prisma.tenantModuleSetting.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: "hr" } },
      create: {
        tenantId,
        moduleKey: "hr",
        adminEnabled: input.moduleEnabled,
        studentEnabled: true,
        parentEnabled: true,
      },
      update: { adminEnabled: input.moduleEnabled },
    });
  }

  await prisma.tenantStaffAttendanceSetting.update({
    where: { tenantId },
    data: {
      moduleEnabled: input.moduleEnabled,
      markingMode: input.markingMode,
      allowManual: input.allowManual,
      allowSelfCheckIn: input.allowSelfCheckIn,
      allowSelfCheckOut: input.allowSelfCheckOut,
      showOfficeLocation: input.showOfficeLocation,
      requireRemarksManual: input.requireRemarksManual,
      halfDayAs: input.halfDayAs,
      colorScheme: input.colorScheme,
      defaultShiftId: input.defaultShiftId,
      workingDays: input.workingDays,
      weeklyOffDays: input.weeklyOffDays,
      workFrom: input.workFrom,
      workTo: input.workTo,
      breakMinutes: input.breakMinutes,
      graceBeforeMinutes: input.graceBeforeMinutes,
      graceAfterMinutes: input.graceAfterMinutes,
      lateAfterMinutes: input.lateAfterMinutes,
      earlyLeavingMinutes: input.earlyLeavingMinutes,
      halfDayAfterMinutes: input.halfDayAfterMinutes,
      overtimeMode: input.overtimeMode,
      minFullDayMinutes: input.minFullDayMinutes,
      markAbsentWeeklyOff: input.markAbsentWeeklyOff,
      markAbsentHoliday: input.markAbsentHoliday,
      autoApplyApprovedLeave: input.autoApplyApprovedLeave,
      autoMarkHoliday: input.autoMarkHoliday,
      leaveDayCounting: input.leaveDayCounting,
      absentMarkingType: input.absentMarkingType,
      cdOnWeeklyOff: input.cdOnWeeklyOff,
      locationTracking: input.locationTracking,
      attendanceRadiusMeters: input.attendanceRadiusMeters,
      allowCheckInOutside: input.allowCheckInOutside,
      allowCheckOutOutside: input.allowCheckOutOutside,
      restrictMultipleLogin: input.restrictMultipleLogin,
      deviceRestriction: input.deviceRestriction,
    },
  });

  return getStaffAttendanceSettingsSetup(tenantId);
}

export async function createStaffWorkShift(
  tenantId: string,
  input: { name: string; startTime: string; endTime: string; isDefault?: boolean },
) {
  const name = input.name.trim();
  const exists = await prisma.staffWorkShift.findFirst({
    where: tenantScope(tenantId, { name }),
    select: { id: true },
  });
  if (exists) throw new AppError(409, `Shift "${name}" already exists`, "SHIFT_EXISTS");

  if (input.isDefault) {
    await prisma.staffWorkShift.updateMany({
      where: { tenantId },
      data: { isDefault: false },
    });
  }

  const shift = await prisma.staffWorkShift.create({
    data: {
      tenantId,
      name,
      startTime: input.startTime,
      endTime: input.endTime,
      isDefault: input.isDefault ?? false,
    },
  });

  if (shift.isDefault) {
    await prisma.tenantStaffAttendanceSetting.updateMany({
      where: { tenantId },
      data: {
        defaultShiftId: shift.id,
        workFrom: shift.startTime,
        workTo: shift.endTime,
      },
    });
  }

  return shift;
}

export async function updateStaffWorkShift(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    startTime?: string;
    endTime?: string;
    isDefault?: boolean;
    isActive?: boolean;
  },
) {
  const existing = await prisma.staffWorkShift.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Shift not found", "SHIFT_NOT_FOUND");

  if (input.name && input.name.trim() !== existing.name) {
    const clash = await prisma.staffWorkShift.findFirst({
      where: tenantScope(tenantId, { name: input.name.trim(), id: { not: id } }),
      select: { id: true },
    });
    if (clash) throw new AppError(409, `Shift "${input.name.trim()}" already exists`, "SHIFT_EXISTS");
  }

  if (input.isDefault) {
    await prisma.staffWorkShift.updateMany({
      where: { tenantId, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const shift = await prisma.staffWorkShift.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      isDefault: input.isDefault,
      isActive: input.isActive,
    },
  });

  if (shift.isDefault) {
    await prisma.tenantStaffAttendanceSetting.updateMany({
      where: { tenantId },
      data: {
        defaultShiftId: shift.id,
        workFrom: shift.startTime,
        workTo: shift.endTime,
      },
    });
  }

  return shift;
}

export async function deleteStaffWorkShift(tenantId: string, id: string) {
  const existing = await prisma.staffWorkShift.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Shift not found", "SHIFT_NOT_FOUND");
  if (existing.isDefault) {
    throw new AppError(400, "Cannot delete the default shift", "DEFAULT_SHIFT");
  }
  await prisma.staffWorkShift.delete({ where: { id } });
  return { ok: true };
}

export async function upsertStaffHoliday(
  tenantId: string,
  input: {
    id?: string;
    title: string;
    startDate: Date;
    endDate?: Date;
    kind?: HolidayKind;
    repeatsAnnually?: boolean;
    description?: string | null;
  },
) {
  const endDate = input.endDate ?? input.startDate;
  if (endDate < input.startDate) {
    throw new AppError(400, "Holiday end date must be on or after start date", "INVALID_DATE_RANGE");
  }
  const data = {
    title: input.title.trim(),
    startDate: input.startDate,
    endDate,
    kind: input.kind ?? HolidayKind.MANDATORY,
    repeatsAnnually: input.repeatsAnnually ?? true,
    description: input.description?.trim() || null,
  };

  if (input.id) {
    const existing = await prisma.holiday.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
      select: { id: true },
    });
    if (!existing) throw new AppError(404, "Holiday not found", "HOLIDAY_NOT_FOUND");
    return prisma.holiday.update({ where: { id: input.id }, data });
  }

  return prisma.holiday.create({ data: { tenantId, ...data } });
}

export async function deleteStaffHoliday(tenantId: string, id: string) {
  const result = await prisma.holiday.deleteMany({ where: tenantScope(tenantId, { id }) });
  if (!result.count) throw new AppError(404, "Holiday not found", "HOLIDAY_NOT_FOUND");
  return { ok: true };
}
