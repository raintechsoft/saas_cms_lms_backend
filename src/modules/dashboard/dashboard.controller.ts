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

  let trends = {
    studentsPct: 0,
    staffPct: 0,
    collectionPct: 0,
    attendancePct: 0,
    enrollmentByMonth: [0, 0, 0, 0, 0, 0] as number[],
  };

  if (auth.tenantId) {
    const tenantId = auth.tenantId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

    const [
      students,
      staff,
      classSections,
      homeworkOpen,
      notices,
      attendanceToday,
      studentsPrev,
      staffPrev,
      paymentsLast30,
      paymentsPrev30,
      attendanceLast7,
      attendancePrev7,
      recentStudents,
    ] = await Promise.all([
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
      prisma.student.count({
        where: { tenantId, status: StudentStatus.ACTIVE, createdAt: { lte: monthAgo } },
      }),
      prisma.user.count({
        where: {
          tenantId,
          status: UserStatus.ACTIVE,
          createdAt: { lte: monthAgo },
          roles: {
            some: {
              role: {
                code: { in: ["TEACHER", "ACCOUNTANT", "STAFF", "INSTITUTION_ADMIN"] },
              },
            },
          },
        },
      }),
      prisma.feePayment.aggregate({
        where: {
          tenantId,
          status: "COLLECTED",
          paymentDate: { gte: monthAgo },
        },
        _sum: { amount: true },
      }),
      prisma.feePayment.aggregate({
        where: {
          tenantId,
          status: "COLLECTED",
          paymentDate: { gte: twoMonthsAgo, lt: monthAgo },
        },
        _sum: { amount: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: {
          tenantId,
          attendanceDate: {
            gte: new Date(Date.now() - 7 * 86400000),
            lte: endOfDay,
          },
        },
        _count: { _all: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ["status"],
        where: {
          tenantId,
          attendanceDate: {
            gte: new Date(Date.now() - 14 * 86400000),
            lt: new Date(Date.now() - 7 * 86400000),
          },
        },
        _count: { _all: true },
      }),
      prisma.student.findMany({
        where: {
          tenantId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1) },
        },
        select: { createdAt: true },
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

    const pctChange = (current: number, previous: number) => {
      if (previous <= 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };

    const collectedNow = Number(paymentsLast30._sum.amount ?? 0);
    const collectedPrev = Number(paymentsPrev30._sum.amount ?? 0);

    const presentRate = (rows: typeof attendanceLast7) => {
      let p = 0;
      let t = 0;
      for (const row of rows) {
        t += row._count._all;
        if (row.status === "PRESENT" || row.status === "LATE" || row.status === "HALF_DAY") {
          p += row._count._all;
        }
      }
      return t > 0 ? (p / t) * 100 : 0;
    };

    const enrollmentByMonth = [0, 0, 0, 0, 0, 0];
    const now = new Date();
    for (const student of recentStudents) {
      const created = new Date(student.createdAt);
      const monthDiff =
        (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
      if (monthDiff >= 0 && monthDiff < 6) {
        enrollmentByMonth[5 - monthDiff] += 1;
      }
    }

    trends = {
      studentsPct: pctChange(students, studentsPrev),
      staffPct: pctChange(staff, staffPrev),
      collectionPct: pctChange(collectedNow, collectedPrev),
      attendancePct: Number(
        (presentRate(attendanceLast7) - presentRate(attendancePrev7)).toFixed(1),
      ),
      enrollmentByMonth,
    };
  }

  res.json({
    data: {
      modules,
      currentSession,
      roles: auth.roles,
      permissions: auth.permissions,
      stats,
      trends,
    },
  });
}
