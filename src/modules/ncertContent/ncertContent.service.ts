import { NcertResourceStatus, NcertResourceType, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

const resourceInclude = {
  subject: { select: { id: true, name: true, code: true } },
  academicClass: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.NcertResourceInclude;

export type NcertResourceInput = {
  title: string;
  description?: string | null;
  chapter?: string | null;
  category?: string | null;
  resourceType?: NcertResourceType | string | null;
  resourceUrl?: string | null;
  fileName?: string | null;
  subjectId?: string | null;
  classId?: string | null;
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

function textOrNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeCategory(value: string | null | undefined) {
  if (!value) return "BOOKS";
  const upper = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const allowed = new Set(["BOOKS", "EXEMPLAR", "SOLUTIONS", "LAB_MANUAL", "RESOURCE_MAP"]);
  if (!allowed.has(upper)) {
    throw new AppError(400, "Invalid NCERT category", "INVALID_CATEGORY");
  }
  return upper;
}

function normalizeType(value: string | null | undefined): NcertResourceType {
  if (!value) return NcertResourceType.LINK;
  const upper = value.trim().toUpperCase();
  if (upper === "FILE") return NcertResourceType.FILE;
  if (upper === "LINK") return NcertResourceType.LINK;
  throw new AppError(400, "resourceType must be LINK or FILE", "INVALID_RESOURCE_TYPE");
}

export async function listNcertResources(
  tenantId: string,
  opts: {
    status?: NcertResourceStatus;
    subjectId?: string;
    classId?: string;
    chapter?: string;
    category?: string;
    search?: string;
    createdById?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = opts.page ?? 1;
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const where: Prisma.NcertResourceWhereInput = {
    tenantId,
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
    ...(opts.classId ? { classId: opts.classId } : {}),
    ...(opts.chapter ? { chapter: { contains: opts.chapter, mode: "insensitive" } } : {}),
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.createdById ? { createdById: opts.createdById } : {}),
    ...(opts.search
      ? {
          OR: [
            { title: { contains: opts.search, mode: "insensitive" } },
            { chapter: { contains: opts.search, mode: "insensitive" } },
            { description: { contains: opts.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.ncertResource.findMany({
      where,
      include: resourceInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ncertResource.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getNcertResourceById(tenantId: string, id: string) {
  const row = await prisma.ncertResource.findFirst({
    where: { id, tenantId },
    include: resourceInclude,
  });
  if (!row) throw new AppError(404, "NCERT resource not found", "NCERT_RESOURCE_NOT_FOUND");
  return row;
}

export async function createNcertResource(
  tenantId: string,
  createdById: string,
  input: NcertResourceInput,
) {
  const title = input.title.trim();
  if (!title) throw new AppError(400, "Title is required", "TITLE_REQUIRED");
  await assertSubject(tenantId, input.subjectId);
  await assertClass(tenantId, input.classId);

  return prisma.ncertResource.create({
    data: {
      tenantId,
      createdById,
      title,
      description: textOrNull(input.description),
      chapter: textOrNull(input.chapter),
      category: normalizeCategory(input.category),
      resourceType: normalizeType(input.resourceType),
      resourceUrl: textOrNull(input.resourceUrl),
      fileName: textOrNull(input.fileName),
      subjectId: input.subjectId || null,
      classId: input.classId || null,
      status: NcertResourceStatus.DRAFT,
    },
    include: resourceInclude,
  });
}

export async function updateNcertResource(
  tenantId: string,
  id: string,
  input: Partial<NcertResourceInput>,
) {
  await getNcertResourceById(tenantId, id);
  if (input.subjectId !== undefined) await assertSubject(tenantId, input.subjectId);
  if (input.classId !== undefined) await assertClass(tenantId, input.classId);

  return prisma.ncertResource.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: textOrNull(input.description) } : {}),
      ...(input.chapter !== undefined ? { chapter: textOrNull(input.chapter) } : {}),
      ...(input.category !== undefined ? { category: normalizeCategory(input.category) } : {}),
      ...(input.resourceType !== undefined ? { resourceType: normalizeType(input.resourceType) } : {}),
      ...(input.resourceUrl !== undefined ? { resourceUrl: textOrNull(input.resourceUrl) } : {}),
      ...(input.fileName !== undefined ? { fileName: textOrNull(input.fileName) } : {}),
      ...(input.subjectId !== undefined ? { subjectId: input.subjectId || null } : {}),
      ...(input.classId !== undefined ? { classId: input.classId || null } : {}),
    },
    include: resourceInclude,
  });
}

export async function publishNcertResource(tenantId: string, id: string) {
  const row = await getNcertResourceById(tenantId, id);
  if (row.status === NcertResourceStatus.ARCHIVED) {
    throw new AppError(400, "Archived NCERT resources cannot be published", "INVALID_STATUS");
  }
  if (!row.title.trim()) {
    throw new AppError(400, "Cannot publish without a title", "TITLE_REQUIRED");
  }
  if (!row.resourceUrl?.trim()) {
    throw new AppError(400, "Cannot publish without a resource URL or file", "RESOURCE_URL_REQUIRED");
  }
  if (!row.classId) {
    throw new AppError(400, "Cannot publish without a class", "CLASS_REQUIRED");
  }

  return prisma.ncertResource.update({
    where: { id },
    data: { status: NcertResourceStatus.PUBLISHED },
    include: resourceInclude,
  });
}

export async function archiveNcertResource(tenantId: string, id: string) {
  await getNcertResourceById(tenantId, id);
  return prisma.ncertResource.update({
    where: { id },
    data: { status: NcertResourceStatus.ARCHIVED },
    include: resourceInclude,
  });
}

export async function deleteNcertResource(tenantId: string, id: string) {
  const row = await getNcertResourceById(tenantId, id);
  if (row.status !== NcertResourceStatus.DRAFT) {
    throw new AppError(400, "Only draft NCERT resources can be deleted", "INVALID_STATUS");
  }
  await prisma.ncertResource.delete({ where: { id } });
  return { ok: true };
}

export async function getNcertStats(tenantId: string, userId: string) {
  const [total, published, drafts, archived, mine] = await Promise.all([
    prisma.ncertResource.count({ where: { tenantId } }),
    prisma.ncertResource.count({ where: { tenantId, status: NcertResourceStatus.PUBLISHED } }),
    prisma.ncertResource.count({ where: { tenantId, status: NcertResourceStatus.DRAFT } }),
    prisma.ncertResource.count({ where: { tenantId, status: NcertResourceStatus.ARCHIVED } }),
    prisma.ncertResource.count({ where: { tenantId, createdById: userId } }),
  ]);
  return { total, published, drafts, archived, mine };
}

export async function getNcertModuleSettings(tenantId: string) {
  return prisma.tenantNcertSetting.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, allowTeachersToCreateNcertResources: false },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateNcertResources: true,
      updatedAt: true,
    },
  });
}

export async function updateNcertModuleSettings(
  tenantId: string,
  allowTeachersToCreateNcertResources: boolean,
) {
  await getNcertModuleSettings(tenantId);
  return prisma.tenantNcertSetting.update({
    where: { tenantId },
    data: { allowTeachersToCreateNcertResources },
    select: {
      id: true,
      tenantId: true,
      allowTeachersToCreateNcertResources: true,
      updatedAt: true,
    },
  });
}

/** Published resources for a student's class. */
export async function listPortalNcertResources(tenantId: string, opts: { classId: string }) {
  return prisma.ncertResource.findMany({
    where: {
      tenantId,
      status: NcertResourceStatus.PUBLISHED,
      classId: opts.classId,
    },
    include: resourceInclude,
    orderBy: [{ subjectId: "asc" }, { chapter: "asc" }, { title: "asc" }],
    take: 100,
  });
}

/** Single published resource for portal deep-links — drafts/archived never returned. */
export async function getPortalNcertResourceById(
  tenantId: string,
  opts: { classId: string; id: string },
) {
  const row = await prisma.ncertResource.findFirst({
    where: {
      id: opts.id,
      tenantId,
      status: NcertResourceStatus.PUBLISHED,
      classId: opts.classId,
    },
    include: resourceInclude,
  });
  if (!row) throw new AppError(404, "NCERT resource not found", "NCERT_RESOURCE_NOT_FOUND");
  return row;
}
