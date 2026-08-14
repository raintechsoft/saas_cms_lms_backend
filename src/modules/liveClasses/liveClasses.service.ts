import { LiveClassStatus, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

const sessionInclude = {
  subject: { select: { id: true, name: true, code: true } },
  academicClass: { select: { id: true, name: true, code: true } },
  classSection: {
    select: {
      id: true,
      section: { select: { id: true, name: true } },
      academicClass: { select: { id: true, name: true } },
    },
  },
  hostTeacher: { select: { id: true, firstName: true, lastName: true, email: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.LiveClassInclude;

export type LiveClassInput = {
  title: string;
  topic?: string | null;
  description?: string | null;
  meetingUrl?: string | null;
  provider?: string | null;
  subjectId?: string | null;
  classId?: string | null;
  classSectionId?: string | null;
  startsAt: string;
  endsAt: string;
  hostTeacherId?: string | null;
};

export type SchedulePhase = "UPCOMING" | "LIVE" | "ENDED" | null;

export function computeSchedulePhase(
  status: LiveClassStatus,
  startsAt: Date,
  endsAt: Date,
  now = new Date(),
): SchedulePhase {
  if (status !== LiveClassStatus.PUBLISHED) return null;
  if (now < startsAt) return "UPCOMING";
  if (now <= endsAt) return "LIVE";
  return "ENDED";
}

function withPhase<T extends { status: LiveClassStatus; startsAt: Date; endsAt: Date }>(row: T) {
  return { ...row, schedulePhase: computeSchedulePhase(row.status, row.startsAt, row.endsAt) };
}

async function assertSubject(tenantId: string, subjectId: string | null | undefined) {
  if (!subjectId) return;
  const row = await prisma.subject.findFirst({ where: { id: subjectId, tenantId }, select: { id: true } });
  if (!row) throw new AppError(400, "Subject is invalid", "INVALID_SUBJECT");
}

async function assertClass(tenantId: string, classId: string | null | undefined) {
  if (!classId) return;
  const row = await prisma.academicClass.findFirst({
    where: { id: classId, tenantId },
    select: { id: true },
  });
  if (!row) throw new AppError(400, "Class is invalid", "INVALID_CLASS");
}

async function assertClassSection(
  tenantId: string,
  classSectionId: string | null | undefined,
  classId: string | null | undefined,
) {
  if (!classSectionId) return;
  const row = await prisma.classSection.findFirst({
    where: { id: classSectionId, tenantId },
    select: { id: true, classId: true },
  });
  if (!row) throw new AppError(400, "Class section is invalid", "INVALID_CLASS_SECTION");
  if (classId && row.classId !== classId) {
    throw new AppError(400, "Class section does not belong to the selected class", "INVALID_CLASS_SECTION");
  }
}

async function assertHost(tenantId: string, hostTeacherId: string) {
  const row = await prisma.user.findFirst({
    where: { id: hostTeacherId, tenantId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!row) throw new AppError(400, "Host teacher is invalid", "INVALID_HOST");
}

function textOrNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseDateTime(value: string, field: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, `${field} is invalid`, "INVALID_DATE");
  }
  return d;
}

function normalizeProvider(value: string | null | undefined) {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  const allowed = new Set(["zoom", "meet", "teams", "other"]);
  if (!allowed.has(normalized)) {
    throw new AppError(400, "provider must be zoom, meet, teams, or other", "INVALID_PROVIDER");
  }
  return normalized;
}

function assertWindow(startsAt: Date, endsAt: Date) {
  if (endsAt <= startsAt) {
    throw new AppError(400, "endsAt must be after startsAt", "INVALID_TIME_WINDOW");
  }
}

export async function listLiveClasses(
  tenantId: string,
  opts: {
    status?: LiveClassStatus;
    subjectId?: string;
    classId?: string;
    hostTeacherId?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = opts.page ?? 1;
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const where: Prisma.LiveClassWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
    ...(opts.classId ? { classId: opts.classId } : {}),
    ...(opts.hostTeacherId ? { hostTeacherId: opts.hostTeacherId } : {}),
    ...(opts.search
      ? {
          OR: [
            { title: { contains: opts.search, mode: "insensitive" } },
            { topic: { contains: opts.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(opts.from || opts.to
      ? {
          startsAt: {
            ...(opts.from ? { gte: parseDateTime(opts.from, "from") } : {}),
            ...(opts.to ? { lte: parseDateTime(opts.to, "to") } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.liveClass.findMany({
      where,
      include: sessionInclude,
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.liveClass.count({ where }),
  ]);

  return { items: items.map(withPhase), total, page, pageSize };
}

export async function getLiveClassById(tenantId: string, id: string) {
  const row = await prisma.liveClass.findFirst({
    where: { id, tenantId },
    include: sessionInclude,
  });
  if (!row) throw new AppError(404, "Live class not found", "LIVE_CLASS_NOT_FOUND");
  return withPhase(row);
}

export async function createLiveClass(
  tenantId: string,
  createdById: string,
  input: LiveClassInput,
) {
  const title = input.title.trim();
  if (!title) throw new AppError(400, "Title is required", "TITLE_REQUIRED");

  const startsAt = parseDateTime(input.startsAt, "startsAt");
  const endsAt = parseDateTime(input.endsAt, "endsAt");
  assertWindow(startsAt, endsAt);

  const hostTeacherId = input.hostTeacherId?.trim() || createdById;
  await assertHost(tenantId, hostTeacherId);
  await assertSubject(tenantId, input.subjectId);
  await assertClass(tenantId, input.classId);
  await assertClassSection(tenantId, input.classSectionId, input.classId);

  const row = await prisma.liveClass.create({
    data: {
      tenantId,
      createdById,
      hostTeacherId,
      title,
      topic: textOrNull(input.topic),
      description: textOrNull(input.description),
      meetingUrl: textOrNull(input.meetingUrl),
      provider: normalizeProvider(input.provider),
      subjectId: input.subjectId || null,
      classId: input.classId || null,
      classSectionId: input.classSectionId || null,
      startsAt,
      endsAt,
      status: LiveClassStatus.DRAFT,
    },
    include: sessionInclude,
  });
  return withPhase(row);
}

export async function updateLiveClass(
  tenantId: string,
  id: string,
  input: Partial<LiveClassInput>,
) {
  const existing = await getLiveClassById(tenantId, id);

  const nextClassId = input.classId !== undefined ? input.classId || null : existing.classId;
  if (input.subjectId !== undefined) await assertSubject(tenantId, input.subjectId);
  if (input.classId !== undefined) await assertClass(tenantId, input.classId);
  if (input.classSectionId !== undefined || input.classId !== undefined) {
    await assertClassSection(
      tenantId,
      input.classSectionId !== undefined ? input.classSectionId : existing.classSectionId,
      nextClassId,
    );
  }
  if (input.hostTeacherId !== undefined && input.hostTeacherId) {
    await assertHost(tenantId, input.hostTeacherId);
  }

  const startsAt =
    input.startsAt !== undefined ? parseDateTime(input.startsAt, "startsAt") : existing.startsAt;
  const endsAt = input.endsAt !== undefined ? parseDateTime(input.endsAt, "endsAt") : existing.endsAt;
  if (input.startsAt !== undefined || input.endsAt !== undefined) {
    assertWindow(startsAt, endsAt);
  }

  const row = await prisma.liveClass.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.topic !== undefined ? { topic: textOrNull(input.topic) } : {}),
      ...(input.description !== undefined ? { description: textOrNull(input.description) } : {}),
      ...(input.meetingUrl !== undefined ? { meetingUrl: textOrNull(input.meetingUrl) } : {}),
      ...(input.provider !== undefined ? { provider: normalizeProvider(input.provider) } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId || null } : {}),
      ...(input.classId !== undefined ? { classId: input.classId || null } : {}),
      ...(input.classSectionId !== undefined
        ? { classSectionId: input.classSectionId || null }
        : {}),
      ...(input.hostTeacherId !== undefined && input.hostTeacherId
        ? { hostTeacherId: input.hostTeacherId }
        : {}),
      ...(input.startsAt !== undefined ? { startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt } : {}),
    },
    include: sessionInclude,
  });
  return withPhase(row);
}

export async function publishLiveClass(tenantId: string, id: string) {
  const row = await getLiveClassById(tenantId, id);
  if (row.status === LiveClassStatus.CANCELLED) {
    throw new AppError(400, "Cancelled live classes cannot be published", "INVALID_STATUS");
  }
  if (!row.title.trim()) {
    throw new AppError(400, "Cannot publish without a title", "TITLE_REQUIRED");
  }
  if (!row.meetingUrl?.trim()) {
    throw new AppError(400, "Cannot publish without a meeting URL", "MEETING_URL_REQUIRED");
  }
  if (!row.classId) {
    throw new AppError(400, "Cannot publish without a class", "CLASS_REQUIRED");
  }
  if (row.endsAt <= row.startsAt) {
    throw new AppError(400, "Invalid time window", "INVALID_TIME_WINDOW");
  }

  const updated = await prisma.liveClass.update({
    where: { id },
    data: { status: LiveClassStatus.PUBLISHED },
    include: sessionInclude,
  });
  return withPhase(updated);
}

export async function cancelLiveClass(tenantId: string, id: string) {
  await getLiveClassById(tenantId, id);
  const updated = await prisma.liveClass.update({
    where: { id },
    data: { status: LiveClassStatus.CANCELLED },
    include: sessionInclude,
  });
  return withPhase(updated);
}

export async function deleteLiveClass(tenantId: string, id: string) {
  const row = await getLiveClassById(tenantId, id);
  if (row.status !== LiveClassStatus.DRAFT) {
    throw new AppError(400, "Only draft live classes can be deleted", "INVALID_STATUS");
  }
  await prisma.liveClass.delete({ where: { id } });
  return { ok: true };
}

export async function getLiveClassesStats(tenantId: string, userId: string) {
  const now = new Date();
  const [total, drafts, published, cancelled, mine, liveNow] = await Promise.all([
    prisma.liveClass.count({ where: { tenantId } }),
    prisma.liveClass.count({ where: { tenantId, status: LiveClassStatus.DRAFT } }),
    prisma.liveClass.count({ where: { tenantId, status: LiveClassStatus.PUBLISHED } }),
    prisma.liveClass.count({ where: { tenantId, status: LiveClassStatus.CANCELLED } }),
    prisma.liveClass.count({ where: { tenantId, createdById: userId } }),
    prisma.liveClass.count({
      where: {
        tenantId,
        status: LiveClassStatus.PUBLISHED,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    }),
  ]);
  return { total, drafts, published, cancelled, mine, liveNow };
}

export async function getLiveClassesModuleSettings(tenantId: string) {
  return prisma.tenantLiveClassesSetting.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, allowTeachersToCreateLiveClasses: false },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateLiveClasses: true,
      updatedAt: true,
    },
  });
}

export async function updateLiveClassesModuleSettings(
  tenantId: string,
  allowTeachersToCreateLiveClasses: boolean,
) {
  await getLiveClassesModuleSettings(tenantId);
  return prisma.tenantLiveClassesSetting.update({
    where: { tenantId },
    data: { allowTeachersToCreateLiveClasses },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateLiveClasses: true,
      updatedAt: true,
    },
  });
}

/** Published sessions visible to a student based on their class / section enrollment. */
export async function listPortalLiveClasses(
  tenantId: string,
  opts: { classId: string; classSectionId: string },
) {
  const now = new Date();
  const from = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const items = await prisma.liveClass.findMany({
    where: {
      tenantId,
      status: LiveClassStatus.PUBLISHED,
      classId: opts.classId,
      OR: [{ classSectionId: null }, { classSectionId: opts.classSectionId }],
      startsAt: { lte: to },
      endsAt: { gte: from },
    },
    include: sessionInclude,
    orderBy: [{ startsAt: "asc" }],
    take: 50,
  });

  return items.map(withPhase);
}
