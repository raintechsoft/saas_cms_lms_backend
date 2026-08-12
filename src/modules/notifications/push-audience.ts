import { EnrollmentStatus, NoticeAudience, UserStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

export async function collectAudienceUserIds(
  tenantId: string,
  audience: NoticeAudience,
  options?: { classSectionId?: string | null; targetUserId?: string | null },
) {
  if (options?.targetUserId) return [options.targetUserId];

  const userIds = new Set<string>();

  if (options?.classSectionId) {
    const enrollments = await prisma.studentEnrollment.findMany({
      where: tenantScope(tenantId, {
        classSectionId: options.classSectionId,
        status: EnrollmentStatus.ACTIVE,
      }),
      select: {
        student: {
          select: {
            userId: true,
            guardians: {
              select: {
                userId: true,
                user: { select: { status: true } },
              },
            },
          },
        },
      },
    });

    for (const row of enrollments) {
      if (
        (audience === NoticeAudience.STUDENTS || audience === NoticeAudience.ALL) &&
        row.student.userId
      ) {
        userIds.add(row.student.userId);
      }
      if (audience === NoticeAudience.PARENTS || audience === NoticeAudience.ALL) {
        for (const link of row.student.guardians) {
          if (link.user.status === UserStatus.ACTIVE) userIds.add(link.userId);
        }
      }
    }
    return [...userIds];
  }

  if (audience === NoticeAudience.STUDENTS || audience === NoticeAudience.ALL) {
    const studentUsers = await prisma.userRole.findMany({
      where: tenantScope(tenantId, {
        role: { code: "STUDENT" },
        user: { status: UserStatus.ACTIVE },
      }),
      select: { userId: true },
    });
    for (const row of studentUsers) userIds.add(row.userId);
  }

  if (audience === NoticeAudience.PARENTS || audience === NoticeAudience.ALL) {
    const parentUsers = await prisma.userRole.findMany({
      where: tenantScope(tenantId, {
        role: { code: "PARENT" },
        user: { status: UserStatus.ACTIVE },
      }),
      select: { userId: true },
    });
    for (const row of parentUsers) userIds.add(row.userId);
  }

  if (audience === NoticeAudience.ALL) {
    const users = await prisma.user.findMany({
      where: tenantScope(tenantId, { status: UserStatus.ACTIVE }),
      select: { id: true },
    });
    for (const row of users) userIds.add(row.id);
  }

  return [...userIds];
}
