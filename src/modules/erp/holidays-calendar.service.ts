import type {
  HolidayCalendarType,
  HolidayKind,
  HolidayStatus,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const TYPE_LABEL: Record<HolidayCalendarType, string> = {
  GAZETTED: "Gazetted",
  OPTIONAL: "Optional",
  RESTRICTED: "Restricted",
};

function kindFromType(type: HolidayCalendarType): HolidayKind {
  if (type === "OPTIONAL") return "OPTIONAL";
  if (type === "RESTRICTED") return "RESTRICTED";
  return "MANDATORY";
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000) + 1);
}

function countWorkingDays(start: Date, end: Date, sundayOff: boolean, saturdayOff: boolean) {
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cursor <= last) {
    const day = cursor.getDay();
    const isOff = (sundayOff && day === 0) || (saturdayOff && day === 6);
    if (!isOff) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

async function ensureGroups(tenantId: string) {
  const count = await prisma.holidayGroup.count({ where: { tenantId } });
  if (count > 0) {
    return prisma.holidayGroup.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  await prisma.holidayGroup.createMany({
    data: [
      {
        tenantId,
        name: "National Holidays",
        description: "Gazetted national holidays",
        color: "#10B981",
      },
      {
        tenantId,
        name: "Religious Holidays",
        description: "Religious observances",
        color: "#3B82F6",
      },
      {
        tenantId,
        name: "School Events",
        description: "School foundation day and events",
        color: "#F59E0B",
      },
      {
        tenantId,
        name: "Regional Holidays",
        description: "State and regional holidays",
        color: "#8B5CF6",
      },
    ],
  });

  return prisma.holidayGroup.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
}

async function ensureSettings(tenantId: string) {
  const existing = await prisma.tenantHolidaySetting.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.tenantHolidaySetting.create({ data: { tenantId } });
}

async function ensureSeedHolidays(
  tenantId: string,
  sessionId: string | null,
  sessionStart: Date,
  sessionEnd: Date,
  groups: Array<{ id: string; name: string }>,
) {
  const existing = await prisma.holiday.count({
    where: {
      tenantId,
      OR: [{ academicSessionId: sessionId }, { academicSessionId: null }],
    },
  });
  if (existing >= 8) return;

  const byName = Object.fromEntries(groups.map((g) => [g.name, g.id]));
  const year = sessionStart.getFullYear();
  const seeds: Array<{
    title: string;
    month: number;
    day: number;
    type: HolidayCalendarType;
    group: string;
  }> = [
    { title: "Labour Day", month: 5, day: 1, type: "GAZETTED", group: "National Holidays" },
    { title: "Buddha Purnima", month: 5, day: 12, type: "GAZETTED", group: "Religious Holidays" },
    { title: "Id-ul-Zuha", month: 5, day: 15, type: "OPTIONAL", group: "Religious Holidays" },
    {
      title: "School Foundation Day",
      month: 5,
      day: 21,
      type: "RESTRICTED",
      group: "School Events",
    },
    { title: "Independence Day", month: 8, day: 15, type: "GAZETTED", group: "National Holidays" },
    { title: "Gandhi Jayanti", month: 10, day: 2, type: "GAZETTED", group: "National Holidays" },
    { title: "Diwali", month: 10, day: 20, type: "GAZETTED", group: "Religious Holidays" },
    { title: "Christmas", month: 12, day: 25, type: "GAZETTED", group: "Religious Holidays" },
    { title: "Republic Day", month: 1, day: 26, type: "GAZETTED", group: "National Holidays" },
    { title: "Holi", month: 3, day: 14, type: "OPTIONAL", group: "Religious Holidays" },
    {
      title: "Annual Day Prep",
      month: 2,
      day: 10,
      type: "RESTRICTED",
      group: "School Events",
    },
    {
      title: "Regional Language Day",
      month: 11,
      day: 1,
      type: "OPTIONAL",
      group: "Regional Holidays",
    },
  ];

  const rows = seeds
    .map((item) => {
      let date = new Date(Date.UTC(year, item.month - 1, item.day));
      if (date < sessionStart) date = new Date(Date.UTC(year + 1, item.month - 1, item.day));
      if (date < sessionStart || date > sessionEnd) return null;
      return {
        tenantId,
        academicSessionId: sessionId,
        groupId: byName[item.group] || null,
        title: item.title,
        startDate: date,
        endDate: date,
        calendarType: item.type,
        kind: kindFromType(item.type),
        status: "ACTIVE" as HolidayStatus,
        repeatsAnnually: true,
        description: null,
      };
    })
    .filter(Boolean) as Prisma.HolidayCreateManyInput[];

  if (rows.length) {
    await prisma.holiday.createMany({ data: rows, skipDuplicates: true });
  }
}

function mapHoliday(row: {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  description: string | null;
  calendarType: HolidayCalendarType;
  status: HolidayStatus;
  repeatsAnnually: boolean;
  academicSessionId: string | null;
  groupId: string | null;
  group: { id: string; name: string; color: string } | null;
  academicSession: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    title: row.title,
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    dateLabel: formatDateLabel(row.startDate),
    dayLabel: formatDayLabel(row.startDate),
    description: row.description,
    calendarType: row.calendarType,
    typeLabel: TYPE_LABEL[row.calendarType],
    status: row.status,
    statusLabel: row.status === "ACTIVE" ? "Active" : "Inactive",
    repeatsAnnually: row.repeatsAnnually,
    academicSessionId: row.academicSessionId,
    academicSessionName: row.academicSession?.name || null,
    groupId: row.groupId,
    groupName: row.group?.name || "—",
    groupColor: row.group?.color || "#9CA3AF",
  };
}

export async function getHolidaysCalendarSetup(
  tenantId: string,
  sessionId?: string | null,
) {
  const [settings, groups, sessions] = await Promise.all([
    ensureSettings(tenantId),
    ensureGroups(tenantId),
    prisma.academicSession.findMany({
      where: { tenantId },
      orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    }),
  ]);

  const session =
    (sessionId && sessions.find((s) => s.id === sessionId)) ||
    sessions.find((s) => s.isCurrent) ||
    sessions[0] ||
    null;

  if (session) {
    await ensureSeedHolidays(tenantId, session.id, session.startDate, session.endDate, groups);
  }

  const holidays = await prisma.holiday.findMany({
    where: {
      tenantId,
      ...(session
        ? {
            OR: [{ academicSessionId: session.id }, { academicSessionId: null }],
          }
        : {}),
    },
    include: {
      group: { select: { id: true, name: true, color: true } },
      academicSession: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const in60 = new Date(now);
  in60.setDate(in60.getDate() + 60);

  const active = holidays.filter((h) => h.status === "ACTIVE");
  const upcoming = active.filter((h) => h.startDate >= now && h.startDate <= in60);
  const restricted = active.filter((h) => h.calendarType === "RESTRICTED");

  let workingDays = 227;
  if (session) {
    const totalWorking = countWorkingDays(
      session.startDate,
      session.endDate,
      settings.sundayIsHoliday,
      settings.saturdayIsHoliday,
    );
    const holidayDays = active.reduce((sum, h) => {
      if (h.calendarType === "RESTRICTED") return sum;
      return sum + daysBetween(h.startDate, h.endDate);
    }, 0);
    workingDays = Math.max(0, totalWorking - holidayDays);
  }

  return {
    stats: {
      totalHolidays: active.length,
      upcomingHolidays: upcoming.length,
      workingDays,
      restrictedDays: restricted.length,
      sessionName: session?.name || "—",
      sessionRange: session
        ? `${formatDateLabel(session.startDate)} - ${formatDateLabel(session.endDate)}`
        : "—",
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      isCurrent: s.isCurrent,
      startDate: toIsoDate(s.startDate),
      endDate: toIsoDate(s.endDate),
    })),
    selectedSessionId: session?.id || null,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      color: g.color,
      isActive: g.isActive,
      holidayCount: holidays.filter((h) => h.groupId === g.id).length,
    })),
    holidays: holidays.map(mapHoliday),
    settings: {
      sundayIsHoliday: settings.sundayIsHoliday,
      saturdayIsHoliday: settings.saturdayIsHoliday,
      autoApplyAttendance: settings.autoApplyAttendance,
      notifyParentsOnHoliday: settings.notifyParentsOnHoliday,
      showOnPortal: settings.showOnPortal,
      defaultCalendarType: settings.defaultCalendarType,
    },
    legend: [
      { key: "GAZETTED", label: "Gazetted Holiday", color: "#10B981" },
      { key: "OPTIONAL", label: "Optional Holiday", color: "#3B82F6" },
      { key: "RESTRICTED", label: "Restricted Holiday", color: "#F59E0B" },
      { key: "SUNDAY", label: "Sunday", color: "#EF4444" },
    ],
    about: [
      "Holidays are excluded from student and staff attendance calculations.",
      "Restricted holidays count as partial working days.",
      "Use Holiday Groups to organize national, religious, and school events.",
    ],
  };
}

export type HolidayInput = {
  academicSessionId?: string | null;
  groupId?: string | null;
  title: string;
  startDate: string;
  endDate?: string;
  description?: string | null;
  calendarType?: HolidayCalendarType;
  status?: HolidayStatus;
  repeatsAnnually?: boolean;
};

async function validateHolidayInput(tenantId: string, input: HolidayInput) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate || input.startDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new AppError(400, "Invalid holiday date", "HOLIDAY_DATE_INVALID");
  }
  if (endDate < startDate) {
    throw new AppError(400, "End date must be on or after start date", "INVALID_DATE_RANGE");
  }

  let academicSessionId = input.academicSessionId ?? null;
  if (academicSessionId) {
    const session = await prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: academicSessionId }),
    });
    if (!session) throw new AppError(400, "Academic session is invalid", "INVALID_SESSION");
    if (startDate < session.startDate || endDate > session.endDate) {
      throw new AppError(400, "Holiday must be within the academic session", "DATE_OUTSIDE_SESSION");
    }
  }

  let groupId = input.groupId ?? null;
  if (groupId) {
    const group = await prisma.holidayGroup.findFirst({
      where: tenantScope(tenantId, { id: groupId }),
    });
    if (!group) throw new AppError(400, "Holiday group is invalid", "INVALID_GROUP");
  }

  const calendarType = input.calendarType ?? "GAZETTED";
  return {
    academicSessionId,
    groupId,
    title: input.title.trim(),
    startDate,
    endDate,
    description: input.description?.trim() || null,
    calendarType,
    kind: kindFromType(calendarType),
    status: input.status ?? "ACTIVE",
    repeatsAnnually: input.repeatsAnnually ?? true,
  };
}

export async function createCalendarHoliday(tenantId: string, input: HolidayInput) {
  const data = await validateHolidayInput(tenantId, input);
  await prisma.holiday.create({ data: { tenantId, ...data } });
  return getHolidaysCalendarSetup(tenantId, data.academicSessionId);
}

export async function updateCalendarHoliday(
  tenantId: string,
  id: string,
  input: HolidayInput,
) {
  const existing = await prisma.holiday.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!existing) throw new AppError(404, "Holiday not found", "HOLIDAY_NOT_FOUND");
  const data = await validateHolidayInput(tenantId, input);
  await prisma.holiday.update({ where: { id }, data });
  return getHolidaysCalendarSetup(tenantId, data.academicSessionId || existing.academicSessionId);
}

export async function deleteCalendarHoliday(
  tenantId: string,
  id: string,
  sessionId?: string | null,
) {
  const existing = await prisma.holiday.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!existing) throw new AppError(404, "Holiday not found", "HOLIDAY_NOT_FOUND");
  await prisma.holiday.delete({ where: { id } });
  return getHolidaysCalendarSetup(tenantId, sessionId || existing.academicSessionId);
}

export async function upsertHolidayGroup(
  tenantId: string,
  input: { id?: string; name: string; description?: string | null; color?: string; isActive?: boolean },
) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, "Group name is required", "GROUP_NAME_REQUIRED");

  if (input.id) {
    const existing = await prisma.holidayGroup.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!existing) throw new AppError(404, "Holiday group not found", "GROUP_NOT_FOUND");
    await prisma.holidayGroup.update({
      where: { id: input.id },
      data: {
        name,
        description: input.description?.trim() || null,
        color: input.color || existing.color,
        isActive: input.isActive ?? existing.isActive,
      },
    });
  } else {
    await prisma.holidayGroup.create({
      data: {
        tenantId,
        name,
        description: input.description?.trim() || null,
        color: input.color || "#7C3AED",
        isActive: input.isActive ?? true,
      },
    });
  }

  return getHolidaysCalendarSetup(tenantId);
}

export async function deleteHolidayGroup(tenantId: string, id: string) {
  const result = await prisma.holidayGroup.deleteMany({
    where: tenantScope(tenantId, { id }),
  });
  if (!result.count) throw new AppError(404, "Holiday group not found", "GROUP_NOT_FOUND");
  return getHolidaysCalendarSetup(tenantId);
}

export async function saveHolidaySettings(
  tenantId: string,
  input: {
    sundayIsHoliday?: boolean;
    saturdayIsHoliday?: boolean;
    autoApplyAttendance?: boolean;
    notifyParentsOnHoliday?: boolean;
    showOnPortal?: boolean;
    defaultCalendarType?: HolidayCalendarType;
  },
) {
  await ensureSettings(tenantId);
  await prisma.tenantHolidaySetting.update({
    where: { tenantId },
    data: {
      ...(input.sundayIsHoliday != null ? { sundayIsHoliday: input.sundayIsHoliday } : {}),
      ...(input.saturdayIsHoliday != null ? { saturdayIsHoliday: input.saturdayIsHoliday } : {}),
      ...(input.autoApplyAttendance != null
        ? { autoApplyAttendance: input.autoApplyAttendance }
        : {}),
      ...(input.notifyParentsOnHoliday != null
        ? { notifyParentsOnHoliday: input.notifyParentsOnHoliday }
        : {}),
      ...(input.showOnPortal != null ? { showOnPortal: input.showOnPortal } : {}),
      ...(input.defaultCalendarType
        ? { defaultCalendarType: input.defaultCalendarType }
        : {}),
    },
  });
  return getHolidaysCalendarSetup(tenantId);
}

export function buildHolidaysExportCsv(
  holidays: Array<{
    dateLabel: string;
    dayLabel: string;
    title: string;
    typeLabel: string;
    groupName: string;
    statusLabel: string;
  }>,
) {
  const header = "Date,Day,Holiday Name,Type,Holiday Group,Status";
  const lines = holidays.map((h) =>
    [h.dateLabel, h.dayLabel, h.title, h.typeLabel, h.groupName, h.statusLabel]
      .map((v) => (`${v}`.includes(",") ? `"${`${v}`.replace(/"/g, '""')}"` : `${v}`))
      .join(","),
  );
  return [header, ...lines].join("\n");
}
