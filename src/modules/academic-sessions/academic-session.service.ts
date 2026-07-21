import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export async function getCurrentAcademicSession(tenantId: string) {
  return prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
    },
  });
}
