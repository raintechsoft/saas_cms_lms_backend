import { LessonPlanStatus, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

const planInclude = {
  subject: { select: { id: true, name: true, code: true } },
  academicClass: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.LessonPlanInclude;

export type LessonPlanInput = {
  title: string;
  topic?: string | null;
  objectives?: string | null;
  materials?: string | null;
  activities?: string | null;
  assessmentNotes?: string | null;
  homework?: string | null;
  subjectId?: string | null;
  classId?: string | null;
  plannedDate?: string | null;
  durationMinutes?: number | null;
};

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

function parseDate(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, "plannedDate is invalid", "INVALID_DATE");
  }
  return d;
}

function textOrNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function listLessonPlans(
  tenantId: string,
  opts: {
    status?: LessonPlanStatus;
    subjectId?: string;
    classId?: string;
    search?: string;
    createdById?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = opts.page ?? 1;
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const where: Prisma.LessonPlanWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
    ...(opts.classId ? { classId: opts.classId } : {}),
    ...(opts.createdById ? { createdById: opts.createdById } : {}),
    ...(opts.search
      ? {
          OR: [
            { title: { contains: opts.search, mode: "insensitive" } },
            { topic: { contains: opts.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.lessonPlan.findMany({
      where,
      include: planInclude,
      orderBy: [{ plannedDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lessonPlan.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getLessonPlanById(tenantId: string, id: string) {
  const plan = await prisma.lessonPlan.findFirst({
    where: { id, tenantId },
    include: planInclude,
  });
  if (!plan) throw new AppError(404, "Lesson plan not found", "LESSON_PLAN_NOT_FOUND");
  return plan;
}

export async function createLessonPlan(
  tenantId: string,
  createdById: string,
  input: LessonPlanInput,
) {
  await assertSubject(tenantId, input.subjectId);
  await assertClass(tenantId, input.classId);
  const title = input.title.trim();
  if (!title) throw new AppError(400, "Title is required", "TITLE_REQUIRED");

  return prisma.lessonPlan.create({
    data: {
      tenantId,
      createdById,
      title,
      topic: textOrNull(input.topic),
      objectives: textOrNull(input.objectives),
      materials: textOrNull(input.materials),
      activities: textOrNull(input.activities),
      assessmentNotes: textOrNull(input.assessmentNotes),
      homework: textOrNull(input.homework),
      subjectId: input.subjectId || null,
      classId: input.classId || null,
      plannedDate: parseDate(input.plannedDate),
      durationMinutes: input.durationMinutes ?? null,
      status: LessonPlanStatus.DRAFT,
    },
    include: planInclude,
  });
}

export async function updateLessonPlan(
  tenantId: string,
  id: string,
  input: Partial<LessonPlanInput>,
) {
  await getLessonPlanById(tenantId, id);
  if (input.subjectId !== undefined) await assertSubject(tenantId, input.subjectId);
  if (input.classId !== undefined) await assertClass(tenantId, input.classId);

  return prisma.lessonPlan.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.topic !== undefined ? { topic: textOrNull(input.topic) } : {}),
      ...(input.objectives !== undefined ? { objectives: textOrNull(input.objectives) } : {}),
      ...(input.materials !== undefined ? { materials: textOrNull(input.materials) } : {}),
      ...(input.activities !== undefined ? { activities: textOrNull(input.activities) } : {}),
      ...(input.assessmentNotes !== undefined
        ? { assessmentNotes: textOrNull(input.assessmentNotes) }
        : {}),
      ...(input.homework !== undefined ? { homework: textOrNull(input.homework) } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId || null } : {}),
      ...(input.classId !== undefined ? { classId: input.classId || null } : {}),
      ...(input.plannedDate !== undefined ? { plannedDate: parseDate(input.plannedDate) } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
    },
    include: planInclude,
  });
}

export async function publishLessonPlan(tenantId: string, id: string) {
  const plan = await getLessonPlanById(tenantId, id);
  if (plan.status === LessonPlanStatus.ARCHIVED) {
    throw new AppError(400, "Archived lesson plans cannot be published", "INVALID_STATUS");
  }
  if (!plan.title.trim()) {
    throw new AppError(400, "Cannot publish an empty lesson plan", "TITLE_REQUIRED");
  }
  return prisma.lessonPlan.update({
    where: { id },
    data: { status: LessonPlanStatus.PUBLISHED },
    include: planInclude,
  });
}

export async function archiveLessonPlan(tenantId: string, id: string) {
  await getLessonPlanById(tenantId, id);
  return prisma.lessonPlan.update({
    where: { id },
    data: { status: LessonPlanStatus.ARCHIVED },
    include: planInclude,
  });
}

export async function deleteLessonPlan(tenantId: string, id: string) {
  await getLessonPlanById(tenantId, id);
  await prisma.lessonPlan.delete({ where: { id } });
  return { ok: true };
}

export async function getLessonPlanningStats(tenantId: string, userId: string) {
  const [total, published, drafts, mine] = await Promise.all([
    prisma.lessonPlan.count({ where: { tenantId } }),
    prisma.lessonPlan.count({ where: { tenantId, status: LessonPlanStatus.PUBLISHED } }),
    prisma.lessonPlan.count({ where: { tenantId, status: LessonPlanStatus.DRAFT } }),
    prisma.lessonPlan.count({ where: { tenantId, createdById: userId } }),
  ]);
  return { total, published, drafts, mine };
}

export async function getLessonPlanningModuleSettings(tenantId: string) {
  return prisma.tenantLessonPlanningSetting.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, allowTeachersToCreateLessonPlans: false },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateLessonPlans: true,
      updatedAt: true,
    },
  });
}

export async function updateLessonPlanningModuleSettings(
  tenantId: string,
  allowTeachersToCreateLessonPlans: boolean,
) {
  await getLessonPlanningModuleSettings(tenantId);
  return prisma.tenantLessonPlanningSetting.update({
    where: { tenantId },
    data: { allowTeachersToCreateLessonPlans },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateLessonPlans: true,
      updatedAt: true,
    },
  });
}
