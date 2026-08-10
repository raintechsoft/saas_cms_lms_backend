import {
  PeriodNumberingMode,
  Weekday,
  type Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALL_WEEKDAYS: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

const DEFAULT_PERIODS: Array<{
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}> = [
  { name: "Period 1", startTime: "08:00", endTime: "08:45", isBreak: false },
  { name: "Period 2", startTime: "08:45", endTime: "09:30", isBreak: false },
  { name: "Short Break", startTime: "09:30", endTime: "09:45", isBreak: true },
  { name: "Period 3", startTime: "09:45", endTime: "10:30", isBreak: false },
  { name: "Period 4", startTime: "10:30", endTime: "11:15", isBreak: false },
  { name: "Lunch Break", startTime: "11:15", endTime: "12:00", isBreak: true },
  { name: "Period 5", startTime: "12:00", endTime: "12:45", isBreak: false },
  { name: "Period 6", startTime: "12:45", endTime: "13:30", isBreak: false },
  { name: "Period 7", startTime: "13:30", endTime: "14:15", isBreak: false },
  { name: "Period 8", startTime: "14:15", endTime: "15:00", isBreak: false },
];

function assertTime(value: string, label: string) {
  if (!TIME_RE.test(value)) {
    throw new AppError(400, `${label} must be HH:mm`, "INVALID_TIME");
  }
}

function assertTimeRange(startTime: string, endTime: string) {
  assertTime(startTime, "Start time");
  assertTime(endTime, "End time");
  if (endTime <= startTime) {
    throw new AppError(400, "End time must be after start time", "INVALID_TIME_RANGE");
  }
}

function normalizeWeekdays(days: Weekday[]) {
  const unique = [...new Set(days)];
  for (const day of unique) {
    if (!ALL_WEEKDAYS.includes(day)) {
      throw new AppError(400, "One or more working days are invalid", "INVALID_WEEKDAY");
    }
  }
  return ALL_WEEKDAYS.filter((day) => unique.includes(day));
}

async function ensureTenantSetting(tenantId: string) {
  return prisma.tenantSetting.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

async function ensureDefaultPeriods(tenantId: string) {
  const count = await prisma.timetablePeriod.count({ where: tenantScope(tenantId, {}) });
  if (count > 0) return;
  await prisma.timetablePeriod.createMany({
    data: DEFAULT_PERIODS.map((period, index) => ({
      tenantId,
      name: period.name,
      startTime: period.startTime,
      endTime: period.endTime,
      isBreak: period.isBreak,
      sortOrder: index + 1,
    })),
  });
}

function mapPeriod(period: {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  sortOrder: number;
}) {
  const [sh, sm] = period.startTime.split(":").map(Number);
  const [eh, em] = period.endTime.split(":").map(Number);
  const durationMins = eh * 60 + em - (sh * 60 + sm);
  return { ...period, durationMins };
}

async function listPeriods(tenantId: string) {
  const periods = await prisma.timetablePeriod.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
  });
  return periods.map(mapPeriod);
}

async function listTemplates(tenantId: string) {
  const [templates, teachingPeriodCount] = await Promise.all([
    prisma.timetableTemplate.findMany({
      where: tenantScope(tenantId, {}),
      include: {
        classes: {
          include: {
            academicClass: { select: { id: true, name: true, sortOrder: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.timetablePeriod.count({ where: tenantScope(tenantId, { isBreak: false }) }),
  ]);

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    workingDays: template.workingDays,
    isActive: template.isActive,
    createdAt: template.createdAt,
    periodCount: teachingPeriodCount,
    classes: template.classes
      .map((row) => row.academicClass)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  }));
}

export async function getTimetablePeriodSetup(tenantId: string) {
  await ensureTenantSetting(tenantId);
  await ensureDefaultPeriods(tenantId);

  const [setting, periods, templates, classes] = await Promise.all([
    prisma.tenantSetting.findUniqueOrThrow({
      where: { tenantId },
      select: {
        workingDays: true,
        defaultPeriodDuration: true,
        firstPeriodStartsAt: true,
        lastPeriodEndsAt: true,
        periodNumberingMode: true,
        allowPeriodOverlap: true,
        enableDoublePeriod: true,
      },
    }),
    listPeriods(tenantId),
    listTemplates(tenantId),
    prisma.academicClass.findMany({
      where: tenantScope(tenantId, {}),
      select: { id: true, name: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return {
    settings: setting,
    periods,
    templates,
    classes,
  };
}

export async function updateTimetablePeriodSettings(
  tenantId: string,
  input: {
    workingDays?: Weekday[];
    defaultPeriodDuration?: number;
    firstPeriodStartsAt?: string;
    lastPeriodEndsAt?: string;
    periodNumberingMode?: PeriodNumberingMode;
    allowPeriodOverlap?: boolean;
    enableDoublePeriod?: boolean;
  },
) {
  await ensureTenantSetting(tenantId);
  if (input.firstPeriodStartsAt) assertTime(input.firstPeriodStartsAt, "First period starts at");
  if (input.lastPeriodEndsAt) assertTime(input.lastPeriodEndsAt, "Last period ends at");
  if (
    input.firstPeriodStartsAt &&
    input.lastPeriodEndsAt &&
    input.lastPeriodEndsAt <= input.firstPeriodStartsAt
  ) {
    throw new AppError(400, "Last period must end after the first period starts", "INVALID_TIME_RANGE");
  }

  const data: Prisma.TenantSettingUpdateInput = {};
  if (input.workingDays) data.workingDays = { set: normalizeWeekdays(input.workingDays) };
  if (input.defaultPeriodDuration !== undefined) data.defaultPeriodDuration = input.defaultPeriodDuration;
  if (input.firstPeriodStartsAt !== undefined) data.firstPeriodStartsAt = input.firstPeriodStartsAt;
  if (input.lastPeriodEndsAt !== undefined) data.lastPeriodEndsAt = input.lastPeriodEndsAt;
  if (input.periodNumberingMode !== undefined) data.periodNumberingMode = input.periodNumberingMode;
  if (input.allowPeriodOverlap !== undefined) data.allowPeriodOverlap = input.allowPeriodOverlap;
  if (input.enableDoublePeriod !== undefined) data.enableDoublePeriod = input.enableDoublePeriod;

  const setting = await prisma.tenantSetting.update({
    where: { tenantId },
    data,
    select: {
      workingDays: true,
      defaultPeriodDuration: true,
      firstPeriodStartsAt: true,
      lastPeriodEndsAt: true,
      periodNumberingMode: true,
      allowPeriodOverlap: true,
      enableDoublePeriod: true,
    },
  });
  return setting;
}

export async function createTimetablePeriod(
  tenantId: string,
  input: {
    name: string;
    startTime: string;
    endTime: string;
    isBreak?: boolean;
    sortOrder?: number;
  },
) {
  assertTimeRange(input.startTime, input.endTime);
  const maxSort = await prisma.timetablePeriod.aggregate({
    where: tenantScope(tenantId, {}),
    _max: { sortOrder: true },
  });
  const period = await prisma.timetablePeriod.create({
    data: {
      tenantId,
      name: input.name.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      isBreak: input.isBreak ?? false,
      sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return mapPeriod(period);
}

export async function updateTimetablePeriod(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    startTime?: string;
    endTime?: string;
    isBreak?: boolean;
    sortOrder?: number;
  },
) {
  const existing = await prisma.timetablePeriod.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Period not found", "PERIOD_NOT_FOUND");

  const startTime = input.startTime ?? existing.startTime;
  const endTime = input.endTime ?? existing.endTime;
  assertTimeRange(startTime, endTime);

  const period = await prisma.timetablePeriod.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      isBreak: input.isBreak,
      sortOrder: input.sortOrder,
    },
  });
  return mapPeriod(period);
}

export async function deleteTimetablePeriod(tenantId: string, id: string) {
  const existing = await prisma.timetablePeriod.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Period not found", "PERIOD_NOT_FOUND");
  await prisma.timetablePeriod.delete({ where: { id } });
  return { ok: true };
}

async function syncTemplateClasses(tenantId: string, templateId: string, classIds: string[]) {
  const unique = [...new Set(classIds)];
  if (unique.length) {
    const count = await prisma.academicClass.count({
      where: tenantScope(tenantId, { id: { in: unique } }),
    });
    if (count !== unique.length) {
      throw new AppError(400, "One or more classes are invalid", "INVALID_CLASS");
    }
  }
  await prisma.$transaction([
    prisma.timetableTemplateClass.deleteMany({
      where: tenantScope(tenantId, { templateId }),
    }),
    ...(unique.length
      ? [
          prisma.timetableTemplateClass.createMany({
            data: unique.map((classId) => ({ tenantId, templateId, classId })),
          }),
        ]
      : []),
  ]);
}

async function loadTemplate(tenantId: string, id: string) {
  const [template, teachingPeriodCount] = await Promise.all([
    prisma.timetableTemplate.findFirst({
      where: tenantScope(tenantId, { id }),
      include: {
        classes: {
          include: {
            academicClass: { select: { id: true, name: true, sortOrder: true } },
          },
        },
      },
    }),
    prisma.timetablePeriod.count({ where: tenantScope(tenantId, { isBreak: false }) }),
  ]);
  if (!template) throw new AppError(404, "Template not found", "TEMPLATE_NOT_FOUND");
  return {
    id: template.id,
    name: template.name,
    workingDays: template.workingDays,
    isActive: template.isActive,
    createdAt: template.createdAt,
    periodCount: teachingPeriodCount,
    classes: template.classes
      .map((row) => row.academicClass)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  };
}

export async function createTimetableTemplate(
  tenantId: string,
  input: {
    name: string;
    classIds?: string[];
    workingDays?: Weekday[];
    isActive?: boolean;
  },
) {
  const setting = await ensureTenantSetting(tenantId);
  const name = input.name.trim();
  const existing = await prisma.timetableTemplate.findFirst({
    where: tenantScope(tenantId, { name }),
    select: { id: true },
  });
  if (existing) throw new AppError(409, `Template "${name}" already exists`, "TEMPLATE_EXISTS");

  const workingDays = normalizeWeekdays(
    input.workingDays?.length ? input.workingDays : setting.workingDays,
  );

  const template = await prisma.timetableTemplate.create({
    data: {
      tenantId,
      name,
      workingDays,
      isActive: input.isActive ?? true,
    },
  });

  if (input.classIds) {
    await syncTemplateClasses(tenantId, template.id, input.classIds);
  }

  return loadTemplate(tenantId, template.id);
}

export async function updateTimetableTemplate(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    classIds?: string[];
    workingDays?: Weekday[];
    isActive?: boolean;
  },
) {
  const existing = await prisma.timetableTemplate.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Template not found", "TEMPLATE_NOT_FOUND");

  if (input.name) {
    const clash = await prisma.timetableTemplate.findFirst({
      where: tenantScope(tenantId, { name: input.name.trim(), id: { not: id } }),
      select: { id: true },
    });
    if (clash) throw new AppError(409, `Template "${input.name.trim()}" already exists`, "TEMPLATE_EXISTS");
  }

  await prisma.timetableTemplate.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      workingDays: input.workingDays ? normalizeWeekdays(input.workingDays) : undefined,
      isActive: input.isActive,
    },
  });

  if (input.classIds) {
    await syncTemplateClasses(tenantId, id, input.classIds);
  }

  return loadTemplate(tenantId, id);
}

export async function deleteTimetableTemplate(tenantId: string, id: string) {
  const existing = await prisma.timetableTemplate.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Template not found", "TEMPLATE_NOT_FOUND");
  await prisma.timetableTemplate.delete({ where: { id } });
  return { ok: true };
}
