import { AcademicEventStatus, AcademicEventType, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

const eventInclude = {
  academicClass: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.AcademicEventInclude;

export type AcademicEventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  eventType?: AcademicEventType | string | null;
  startAt: string | Date;
  endAt?: string | Date | null;
  allDay?: boolean | null;
  classId?: string | null;
};

function textOrNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeType(value: string | null | undefined): AcademicEventType {
  if (!value) return AcademicEventType.ACADEMIC;
  const upper = value.trim().toUpperCase();
  const allowed = Object.values(AcademicEventType) as string[];
  if (!allowed.includes(upper)) {
    throw new AppError(400, "Invalid event type", "INVALID_EVENT_TYPE");
  }
  return upper as AcademicEventType;
}

function parseDate(value: string | Date, field: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, `${field} is invalid`, "INVALID_DATE");
  }
  return date;
}

/** Events that overlap [from, to]: startAt <= to AND (endAt ?? startAt) >= from. */
function dateRangeOverlapFilter(
  from?: Date,
  to?: Date,
): Prisma.AcademicEventWhereInput | undefined {
  if (!from && !to) return undefined;
  return {
    AND: [
      ...(to ? [{ startAt: { lte: to } }] : []),
      ...(from
        ? [
            {
              OR: [
                { endAt: { gte: from } },
                { AND: [{ endAt: null }, { startAt: { gte: from } }] },
              ],
            },
          ]
        : []),
    ],
  };
}

async function assertClass(tenantId: string, classId: string | null | undefined) {
  if (!classId) return;
  const row = await prisma.academicClass.findFirst({
    where: { id: classId, tenantId },
    select: { id: true },
  });
  if (!row) throw new AppError(400, "Class is invalid", "INVALID_CLASS");
}

export async function listAcademicEvents(
  tenantId: string,
  opts: {
    status?: AcademicEventStatus;
    eventType?: AcademicEventType;
    classId?: string;
    search?: string;
    from?: string;
    to?: string;
    createdById?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = opts.page ?? 1;
  const pageSize = Math.min(200, opts.pageSize ?? 100);
  const from = opts.from ? parseDate(opts.from, "from") : undefined;
  const to = opts.to ? parseDate(opts.to, "to") : undefined;
  const rangeFilter = dateRangeOverlapFilter(from, to);

  const and: Prisma.AcademicEventWhereInput[] = [];
  if (opts.classId) {
    and.push({ OR: [{ classId: opts.classId }, { classId: null }] });
  }
  if (rangeFilter) and.push(rangeFilter);
  if (opts.search) {
    and.push({
      OR: [
        { title: { contains: opts.search, mode: "insensitive" } },
        { description: { contains: opts.search, mode: "insensitive" } },
        { location: { contains: opts.search, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.AcademicEventWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.eventType ? { eventType: opts.eventType } : {}),
    ...(opts.createdById ? { createdById: opts.createdById } : {}),
    ...(and.length ? { AND: and } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.academicEvent.findMany({
      where,
      include: eventInclude,
      orderBy: [{ startAt: "asc" }, { title: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.academicEvent.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getAcademicEventById(tenantId: string, id: string) {
  const row = await prisma.academicEvent.findFirst({
    where: { id, tenantId },
    include: eventInclude,
  });
  if (!row) throw new AppError(404, "Calendar event not found", "ACADEMIC_EVENT_NOT_FOUND");
  return row;
}

export async function createAcademicEvent(
  tenantId: string,
  createdById: string,
  input: AcademicEventInput,
) {
  const title = input.title.trim();
  if (!title) throw new AppError(400, "Title is required", "TITLE_REQUIRED");
  const startAt = parseDate(input.startAt, "startAt");
  const endAt = input.endAt != null && input.endAt !== "" ? parseDate(input.endAt, "endAt") : null;
  if (endAt && endAt < startAt) {
    throw new AppError(400, "End date must be on or after start date", "INVALID_DATE_RANGE");
  }
  await assertClass(tenantId, input.classId);

  return prisma.academicEvent.create({
    data: {
      tenantId,
      createdById,
      title,
      description: textOrNull(input.description),
      location: textOrNull(input.location),
      eventType: normalizeType(input.eventType),
      startAt,
      endAt,
      allDay: input.allDay ?? true,
      classId: input.classId || null,
      status: AcademicEventStatus.DRAFT,
    },
    include: eventInclude,
  });
}

export async function updateAcademicEvent(
  tenantId: string,
  id: string,
  input: Partial<AcademicEventInput>,
) {
  await getAcademicEventById(tenantId, id);
  if (input.classId !== undefined) await assertClass(tenantId, input.classId);

  const startAt =
    input.startAt !== undefined ? parseDate(input.startAt, "startAt") : undefined;
  const endAt =
    input.endAt !== undefined
      ? input.endAt == null || input.endAt === ""
        ? null
        : parseDate(input.endAt, "endAt")
      : undefined;

  return prisma.academicEvent.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: textOrNull(input.description) } : {}),
      ...(input.location !== undefined ? { location: textOrNull(input.location) } : {}),
      ...(input.eventType !== undefined ? { eventType: normalizeType(input.eventType) } : {}),
      ...(startAt !== undefined ? { startAt } : {}),
      ...(endAt !== undefined ? { endAt } : {}),
      ...(input.allDay !== undefined ? { allDay: input.allDay ?? true } : {}),
      ...(input.classId !== undefined ? { classId: input.classId || null } : {}),
    },
    include: eventInclude,
  });
}

export async function publishAcademicEvent(tenantId: string, id: string) {
  const row = await getAcademicEventById(tenantId, id);
  if (row.status === AcademicEventStatus.ARCHIVED) {
    throw new AppError(400, "Archived events cannot be published", "INVALID_STATUS");
  }
  if (!row.title.trim()) {
    throw new AppError(400, "Cannot publish without a title", "TITLE_REQUIRED");
  }
  return prisma.academicEvent.update({
    where: { id },
    data: { status: AcademicEventStatus.PUBLISHED },
    include: eventInclude,
  });
}

export async function archiveAcademicEvent(tenantId: string, id: string) {
  await getAcademicEventById(tenantId, id);
  return prisma.academicEvent.update({
    where: { id },
    data: { status: AcademicEventStatus.ARCHIVED },
    include: eventInclude,
  });
}

export async function deleteAcademicEvent(tenantId: string, id: string) {
  const row = await getAcademicEventById(tenantId, id);
  if (row.status !== AcademicEventStatus.DRAFT) {
    throw new AppError(400, "Only draft events can be deleted", "INVALID_STATUS");
  }
  await prisma.academicEvent.delete({ where: { id } });
  return { ok: true };
}

export async function getAcademicCalendarStats(
  tenantId: string,
  opts: { from?: string; to?: string } = {},
) {
  const from = opts.from ? parseDate(opts.from, "from") : undefined;
  const to = opts.to ? parseDate(opts.to, "to") : undefined;
  const rangeFilter = dateRangeOverlapFilter(from, to);
  const base: Prisma.AcademicEventWhereInput = {
    tenantId,
    ...(rangeFilter ?? {}),
  };
  const [total, published, drafts, archived, byType] = await Promise.all([
    prisma.academicEvent.count({ where: base }),
    prisma.academicEvent.count({ where: { ...base, status: AcademicEventStatus.PUBLISHED } }),
    prisma.academicEvent.count({ where: { ...base, status: AcademicEventStatus.DRAFT } }),
    prisma.academicEvent.count({ where: { ...base, status: AcademicEventStatus.ARCHIVED } }),
    prisma.academicEvent.groupBy({
      by: ["eventType"],
      where: { ...base, status: { in: [AcademicEventStatus.PUBLISHED, AcademicEventStatus.DRAFT] } },
      _count: true,
    }),
  ]);

  const typeCounts: Record<string, number> = {
    ACADEMIC: 0,
    EXAMINATION: 0,
    HOLIDAY: 0,
    MEETING: 0,
    OTHER: 0,
    IMPORTANT: 0,
  };
  for (const row of byType) {
    typeCounts[row.eventType] = row._count;
  }

  return { total, published, drafts, archived, byType: typeCounts };
}

export async function getAcademicCalendarSettings(tenantId: string) {
  return prisma.tenantAcademicCalendarSetting.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      allowTeachersToCreateEvents: false,
      importantNotes:
        "Events and dates are subject to change. Please check regularly for updates.\nFor any queries regarding the academic calendar, contact the school administration.",
    },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateEvents: true,
      importantNotes: true,
      updatedAt: true,
    },
  });
}

export async function updateAcademicCalendarSettings(
  tenantId: string,
  input: { allowTeachersToCreateEvents?: boolean; importantNotes?: string | null },
) {
  await getAcademicCalendarSettings(tenantId);
  return prisma.tenantAcademicCalendarSetting.update({
    where: { tenantId },
    data: {
      ...(input.allowTeachersToCreateEvents !== undefined
        ? { allowTeachersToCreateEvents: input.allowTeachersToCreateEvents }
        : {}),
      ...(input.importantNotes !== undefined ? { importantNotes: textOrNull(input.importantNotes) } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateEvents: true,
      importantNotes: true,
      updatedAt: true,
    },
  });
}

/** Published events for a student's class (class-specific + school-wide). */
export async function listPortalAcademicEvents(
  tenantId: string,
  opts: { classId: string; from?: string; to?: string },
) {
  const from = opts.from ? parseDate(opts.from, "from") : undefined;
  const to = opts.to ? parseDate(opts.to, "to") : undefined;
  const rangeFilter = dateRangeOverlapFilter(from, to);
  return prisma.academicEvent.findMany({
    where: {
      tenantId,
      status: AcademicEventStatus.PUBLISHED,
      OR: [{ classId: null }, { classId: opts.classId }],
      ...(rangeFilter ?? {}),
    },
    include: eventInclude,
    orderBy: [{ startAt: "asc" }, { title: "asc" }],
    take: 200,
  });
}
