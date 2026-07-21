import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export async function recordAudit(
  tenantId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.auditLog.create({
    data: { tenantId, userId, action, entityType, entityId, metadata },
  });
}
