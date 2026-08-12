import { NoticeAudience, NotificationType } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import {
  dispatchPortalAudienceAlert,
  getTenantDisplayName,
} from "../mobile/portal-alert.service.js";

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

  const audience = input.audience ?? NoticeAudience.ALL;
  const tenantName = await getTenantDisplayName(tenantId);

  const notice = await prisma.notice.create({
    data: {
      tenantId,
      createdById,
      title: input.title.trim(),
      body: input.body.trim(),
      attachmentUrl: input.attachmentUrl?.trim() || null,
      audience,
      academicSessionId: input.academicSessionId ?? null,
      classSectionId: input.classSectionId ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });

  await prisma.notification.create({
    data: {
      tenantId,
      createdById,
      title: input.title.trim(),
      body: input.body.trim(),
      type: NotificationType.ANNOUNCEMENT,
      audience,
      classSectionId: input.classSectionId ?? null,
    },
  });

  try {
    await dispatchPortalAudienceAlert(
      tenantId,
      {
        category: "NOTICE",
        title: notice.title,
        body: notice.body,
        type: NotificationType.ANNOUNCEMENT,
        screen: "notices",
        tenantName,
        referenceId: notice.id,
      },
      {
        audience,
        classSectionId: input.classSectionId ?? null,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "notice push failed";
    console.error(`[notices] Push dispatch failed: ${message}`);
  }

  return notice;
}

export async function deleteNotice(tenantId: string, id: string) {
  const result = await prisma.notice.deleteMany({ where: tenantScope(tenantId, { id }) });
  if (!result.count) throw new AppError(404, "Notice not found", "NOTICE_NOT_FOUND");
}

export async function updateNotice(
  tenantId: string,
  id: string,
  input: {
    title?: string;
    body?: string;
    attachmentUrl?: string | null;
    audience?: NoticeAudience;
    academicSessionId?: string | null;
    classSectionId?: string | null;
    expiresAt?: Date | null;
  },
) {
  const existing = await prisma.notice.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!existing) throw new AppError(404, "Notice not found", "NOTICE_NOT_FOUND");
  if (input.classSectionId) {
    const section = await prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: input.classSectionId }),
    });
    if (!section) throw new AppError(400, "Invalid class section", "INVALID_CLASS_SECTION");
  }
  return prisma.notice.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      ...(input.attachmentUrl !== undefined
        ? { attachmentUrl: input.attachmentUrl?.trim() || null }
        : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      ...(input.academicSessionId !== undefined
        ? { academicSessionId: input.academicSessionId }
        : {}),
      ...(input.classSectionId !== undefined ? { classSectionId: input.classSectionId } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      classSection: { include: { academicClass: true, section: true } },
    },
  });
}
