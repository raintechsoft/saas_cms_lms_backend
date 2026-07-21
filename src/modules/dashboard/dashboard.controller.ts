import type { Request, Response } from "express";
import { ProductMode, StudentStatus, UserStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getCurrentAcademicSession } from "../academic-sessions/academic-session.service.js";

export async function dashboardController(req: Request, res: Response) {
  const auth = req.auth!;
  const currentSession = auth.tenantId
    ? await getCurrentAcademicSession(auth.tenantId)
    : null;

  const modules =
    auth.productMode === ProductMode.BOTH
      ? ["CMS", "LMS"]
      : auth.productMode
        ? [auth.productMode]
        : ["PLATFORM"];

  let stats = {
    students: 0,
    staff: 0,
    classSections: 0,
    homeworkOpen: 0,
    notices: 0,
    attendanceToday: { present: 0, absent: 0, total: 0 },
  };

  if (auth.tenantId) {
    const tenantId = auth.tenantId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [students, staff, classSections, homeworkOpen, notices, attendanceToday] =
      await Promise.all([
        prisma.student.count({
          where: { tenantId, status: StudentStatus.ACTIVE },
        }),
        prisma.user.count({
          where: {
            tenantId,
            status: UserStatus.ACTIVE,
            roles: {
              some: {
                role: {
                  code: { in: ["TEACHER", "ACCOUNTANT", "STAFF", "INSTITUTION_ADMIN"] },
                },
              },
            },
          },
        }),
        prisma.classSection.count({
          where: {
            tenantId,
            ...(currentSession ? { academicSessionId: currentSession.id } : {}),
          },
        }),
        prisma.homework.count({
          where: {
            tenantId,
            submissionDate: { gte: startOfDay },
          },
        }),
        prisma.notice.count({
          where: { tenantId },
        }),
        prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: {
            tenantId,
            attendanceDate: { gte: startOfDay, lte: endOfDay },
          },
          _count: { _all: true },
        }),
      ]);

    let present = 0;
    let absent = 0;
    let total = 0;
    for (const row of attendanceToday) {
      const count = row._count._all;
      total += count;
      if (row.status === "PRESENT" || row.status === "LATE" || row.status === "HALF_DAY") {
        present += count;
      }
      if (row.status === "ABSENT") absent += count;
    }

    stats = {
      students,
      staff,
      classSections,
      homeworkOpen,
      notices,
      attendanceToday: { present, absent, total },
    };
  }

  res.json({
    data: {
      modules,
      currentSession,
      roles: auth.roles,
      permissions: auth.permissions,
      stats,
    },
  });
}
