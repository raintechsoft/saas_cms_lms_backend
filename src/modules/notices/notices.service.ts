import { NoticeAudience } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export async function listNotices(tenantId: string) {
  return prisma.notice.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: { publishedAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      classSection: { include: { academicClass: true, section: true } },
    },
  });
}

export async function createNotice(
  tenantId: string,
  createdById: string,
  input: {
    title: string;
    body: string;
    attachmentUrl?: string | null;
    audience?: NoticeAudience;
    academicSessionId?: string | null;
    classSectionId?: string | null;
    expiresAt?: Date | null;
  },
) {
  if (input.classSectionId) {
    const section = await prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: input.classSectionId }),
    });
    if (!section) throw new AppError(400, "Invalid class section", "INVALID_CLASS_SECTION");
  }
  return prisma.notice.create({
    data: {
      tenantId,
      createdById,
      title: input.title.trim(),
      body: input.body.trim(),
      attachmentUrl: input.attachmentUrl?.trim() || null,
      audience: input.audience ?? NoticeAudience.ALL,
      academicSessionId: input.academicSessionId ?? null,
      classSectionId: input.classSectionId ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export async function deleteNotice(tenantId: string, id: string) {
  const result = await prisma.notice.deleteMany({ where: tenantScope(tenantId, { id }) });
  if (!result.count) throw new AppError(404, "Notice not found", "NOTICE_NOT_FOUND");
}
