import {
  AttendanceStatus,
  AttendanceType,
  EnrollmentStatus,
  LeaveStatus,
  type Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

interface MarkAttendanceItem {
  studentEnrollmentId: string;
  status: AttendanceStatus;
  inTime?: string | null;
  outTime?: string | null;
  note?: string | null;
}

export async function getAttendanceSetup(
  tenantId: string,
  query: { classSectionId?: string; date: Date; periodKey?: string },
) {
  const [setting, currentSession] = await Promise.all([
    prisma.tenantSetting.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    }),
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { isCurrent: true }),
    }),
  ]);
  const classSections = currentSession
    ? await prisma.classSection.findMany({
        where: tenantScope(tenantId, { academicSessionId: currentSession.id }),
        include: { academicClass: true, section: true },
        orderBy: [
          { academicClass: { sortOrder: "asc" } },
          { section: { name: "asc" } },
        ],
      })
    : [];

  let roster: unknown[] = [];
  if (query.classSectionId && currentSession) {
    const classSection = classSections.find(({ id }) => id === query.classSectionId);
    if (!classSection) {
      throw new AppError(400, "Class section is invalid", "INVALID_CLASS_SECTION");
    }
    const periodKey = setting.attendanceType === AttendanceType.PERIOD_WISE
      ? query.periodKey?.trim() || "PERIOD-1"
      : "DAY";
    roster = await prisma.studentEnrollment.findMany({
      where: tenantScope(tenantId, {
        classSectionId: query.classSectionId,
        status: EnrollmentStatus.ACTIVE,
      }),
      include: {
        student: true,
        attendanceRecords: {
          where: { attendanceDate: query.date, periodKey },
        },
        leaveRequests: {
          where: {
            status: LeaveStatus.APPROVED,
            fromDate: { lte: query.date },
            toDate: { gte: query.date },
          },
        },
      },
      orderBy: [{ rollNumber: "asc" }, { student: { firstName: "asc" } }],
    });
  }

  const pendingLeaves = await prisma.studentLeave.findMany({
    where: tenantScope(tenantId, { status: LeaveStatus.PENDING }),
    include: {
      studentEnrollment: {
        include: {
          student: true,
          classSection: { include: { academicClass: true, section: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    attendanceType: setting.attendanceType,
    currentSession,
    classSections,
    roster,
    pendingLeaves,
  };
}

export async function markAttendance(
  tenantId: string,
  userId: string,
  input: {
    classSectionId: string;
    attendanceDate: Date;
    periodKey?: string;
    records: MarkAttendanceItem[];
  },
) {
  const [classSection, setting] = await Promise.all([
    prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: input.classSectionId }),
      include: { academicSession: true },
    }),
    prisma.tenantSetting.findUnique({ where: { tenantId } }),
  ]);
  if (!classSection) {
    throw new AppError(400, "Class section is invalid", "INVALID_CLASS_SECTION");
  }
  if (
    input.attendanceDate < classSection.academicSession.startDate ||
    input.attendanceDate > classSection.academicSession.endDate
  ) {
    throw new AppError(
      400,
      "Attendance date is outside the academic session",
      "DATE_OUTSIDE_SESSION",
    );
  }
  const periodKey = setting?.attendanceType === AttendanceType.PERIOD_WISE
    ? input.periodKey?.trim()
    : "DAY";
  if (!periodKey) {
    throw new AppError(400, "Period is required for period-wise attendance", "PERIOD_REQUIRED");
  }
  const ids = [...new Set(input.records.map(({ studentEnrollmentId }) => studentEnrollmentId))];
  if (ids.length !== input.records.length) {
    throw new AppError(400, "Duplicate student in attendance", "DUPLICATE_ATTENDANCE");
  }
  const validCount = await prisma.studentEnrollment.count({
    where: tenantScope(tenantId, {
      id: { in: ids },
      classSectionId: classSection.id,
      academicSessionId: classSection.academicSessionId,
      status: EnrollmentStatus.ACTIVE,
    }),
  });
  if (validCount !== ids.length) {
    throw new AppError(400, "One or more students are invalid", "INVALID_ENROLLMENT");
  }

  await prisma.$transaction(
    input.records.map((record) =>
      prisma.attendanceRecord.upsert({
        where: {
          tenantId_studentEnrollmentId_attendanceDate_periodKey: {
            tenantId,
            studentEnrollmentId: record.studentEnrollmentId,
            attendanceDate: input.attendanceDate,
            periodKey,
          },
        },
        create: {
          tenantId,
          studentEnrollmentId: record.studentEnrollmentId,
          academicSessionId: classSection.academicSessionId,
          classSectionId: classSection.id,
          attendanceDate: input.attendanceDate,
          periodKey,
          status: record.status,
          inTime: record.inTime,
          outTime: record.outTime,
          note: record.note,
          markedById: userId,
        },
        update: {
          status: record.status,
          inTime: record.inTime,
          outTime: record.outTime,
          note: record.note,
          markedById: userId,
        },
      }),
    ),
  );
  return { marked: input.records.length, periodKey };
}

export async function getAttendanceReport(
  tenantId: string,
  query: {
    fromDate: Date;
    toDate: Date;
    classSectionId?: string;
    studentId?: string;
    periodKey?: string;
  },
) {
  if (query.toDate < query.fromDate) {
    throw new AppError(400, "End date must be on or after start date", "INVALID_DATES");
  }
  const records = await prisma.attendanceRecord.findMany({
    where: tenantScope(tenantId, {
      attendanceDate: { gte: query.fromDate, lte: query.toDate },
      classSectionId: query.classSectionId,
      periodKey: query.periodKey,
      studentEnrollment: query.studentId
        ? { studentId: query.studentId }
        : undefined,
    }),
    include: {
      studentEnrollment: {
        include: {
          student: true,
          classSection: { include: { academicClass: true, section: true } },
        },
      },
    },
    orderBy: [{ attendanceDate: "desc" }, { studentEnrollment: { rollNumber: "asc" } }],
  });

  const summary = new Map<string, {
    student: (typeof records)[number]["studentEnrollment"]["student"];
    present: number;
    late: number;
    absent: number;
    halfDay: number;
    holiday: number;
    total: number;
  }>();
  for (const record of records) {
    const studentId = record.studentEnrollment.studentId;
    const item = summary.get(studentId) ?? {
      student: record.studentEnrollment.student,
      present: 0,
      late: 0,
      absent: 0,
      halfDay: 0,
      holiday: 0,
      total: 0,
    };
    item.total++;
    if (record.status === AttendanceStatus.PRESENT) item.present++;
    if (record.status === AttendanceStatus.LATE) item.late++;
    if (record.status === AttendanceStatus.ABSENT) item.absent++;
    if (record.status === AttendanceStatus.HALF_DAY) item.halfDay++;
    if (record.status === AttendanceStatus.HOLIDAY) item.holiday++;
    summary.set(studentId, item);
  }
  const summaries = [...summary.values()].map((item) => {
    const counted = item.total - item.holiday;
    const attended = item.present + item.late + item.halfDay * 0.5;
    return {
      ...item,
      percentage: counted ? Math.round(attended / counted * 10000) / 100 : 0,
    };
  });
  return { records, summaries };
}

export async function createLeave(
  tenantId: string,
  userId: string,
  input: {
    studentEnrollmentId: string;
    fromDate: Date;
    toDate: Date;
    reason: string;
    status?: LeaveStatus;
  },
) {
  if (input.toDate < input.fromDate) {
    throw new AppError(400, "Leave end date must be on or after start date", "INVALID_DATES");
  }
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: tenantScope(tenantId, { id: input.studentEnrollmentId }),
  });
  if (!enrollment) {
    throw new AppError(400, "Student enrolment is invalid", "INVALID_ENROLLMENT");
  }
  const status = input.status ?? LeaveStatus.PENDING;
  const reviewed =
    status === LeaveStatus.PENDING
      ? {}
      : { reviewedById: userId, reviewedAt: new Date() };
  return prisma.studentLeave.create({
    data: {
      tenantId,
      academicSessionId: enrollment.academicSessionId,
      studentEnrollmentId: input.studentEnrollmentId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      reason: input.reason,
      status,
      ...reviewed,
    },
    include: {
      studentEnrollment: {
        include: {
          student: true,
          classSection: { include: { academicClass: true, section: true } },
        },
      },
    },
  });
}

export async function listLeaves(
  tenantId: string,
  status?: LeaveStatus,
) {
  return prisma.studentLeave.findMany({
    where: tenantScope(tenantId, { status }),
    include: {
      studentEnrollment: {
        include: {
          student: true,
          classSection: { include: { academicClass: true, section: true } },
        },
      },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function reviewLeave(
  tenantId: string,
  userId: string,
  leaveId: string,
  input: { status: Exclude<LeaveStatus, "PENDING">; reviewNote?: string | null },
) {
  const leave = await prisma.studentLeave.findFirst({
    where: tenantScope(tenantId, { id: leaveId }),
  });
  if (!leave) throw new AppError(404, "Leave request not found", "LEAVE_NOT_FOUND");
  if (leave.status !== LeaveStatus.PENDING) {
    throw new AppError(409, "Leave request is already reviewed", "LEAVE_REVIEWED");
  }
  return prisma.studentLeave.update({
    where: { id: leaveId },
    data: {
      status: input.status,
      reviewNote: input.reviewNote,
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });
}

export async function awardAttendancePoints(
  tenantId: string,
  userId: string,
  input: { studentEnrollmentId: string; pointDate: Date; points: number; note?: string | null },
) {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: tenantScope(tenantId, { id: input.studentEnrollmentId }),
  });
  if (!enrollment) {
    throw new AppError(400, "Student enrolment is invalid", "INVALID_ENROLLMENT");
  }
  return prisma.attendancePoint.create({
    data: {
      tenantId,
      academicSessionId: enrollment.academicSessionId,
      awardedById: userId,
      ...input,
    },
  });
}

export async function getAttendancePoints(
  tenantId: string,
  sessionId: string,
) {
  const points = await prisma.attendancePoint.groupBy({
    by: ["studentEnrollmentId"],
    where: tenantScope(tenantId, { academicSessionId: sessionId }),
    _sum: { points: true },
  });
  const enrollments = await prisma.studentEnrollment.findMany({
    where: tenantScope(tenantId, {
      id: { in: points.map(({ studentEnrollmentId }) => studentEnrollmentId) },
    }),
    include: { student: true, classSection: { include: { academicClass: true, section: true } } },
  });
  const byId = new Map(enrollments.map((item) => [item.id, item]));
  return points.map((item) => ({
    enrollment: byId.get(item.studentEnrollmentId),
    points: item._sum.points ?? 0,
  }));
}

export async function getAttendancePointScores(tenantId: string, sessionId?: string) {
  await prisma.tenantSetting.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });

  const [settingRows, session] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        attendance_present_points: number;
        attendance_half_day_points: number;
        attendance_late_points: number;
      }>
    >`SELECT attendance_present_points, attendance_half_day_points, attendance_late_points
      FROM tenant_settings WHERE tenant_id = ${tenantId} LIMIT 1`,
    sessionId
      ? prisma.academicSession.findFirst({ where: tenantScope(tenantId, { id: sessionId }) })
      : prisma.academicSession.findFirst({ where: tenantScope(tenantId, { isCurrent: true }) }),
  ]);
  if (!session) {
    throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
  }

  const presentPts = Number(settingRows[0]?.attendance_present_points ?? 2);
  const halfPts = Number(settingRows[0]?.attendance_half_day_points ?? 1);
  const latePts = Number(settingRows[0]?.attendance_late_points ?? -1);

  const [enrollments, records] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: tenantScope(tenantId, {
        academicSessionId: session.id,
        status: EnrollmentStatus.ACTIVE,
      }),
      include: {
        student: true,
        classSection: { include: { academicClass: true, section: true } },
      },
      orderBy: [
        { classSection: { academicClass: { sortOrder: "asc" } } },
        { classSection: { section: { name: "asc" } } },
        { rollNumber: "asc" },
      ],
    }),
    prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, { academicSessionId: session.id }),
      select: { studentEnrollmentId: true, status: true },
    }),
  ]);

  const counts = new Map<
    string,
    { present: number; late: number; absent: number; halfDay: number; holiday: number }
  >();
  for (const record of records) {
    const current = counts.get(record.studentEnrollmentId) ?? {
      present: 0,
      late: 0,
      absent: 0,
      halfDay: 0,
      holiday: 0,
    };
    if (record.status === AttendanceStatus.PRESENT) current.present += 1;
    if (record.status === AttendanceStatus.LATE) current.late += 1;
    if (record.status === AttendanceStatus.ABSENT) current.absent += 1;
    if (record.status === AttendanceStatus.HALF_DAY) current.halfDay += 1;
    if (record.status === AttendanceStatus.HOLIDAY) current.holiday += 1;
    counts.set(record.studentEnrollmentId, current);
  }

  const scores = enrollments.map((enrollment) => {
    const tally = counts.get(enrollment.id) ?? {
      present: 0,
      late: 0,
      absent: 0,
      halfDay: 0,
      holiday: 0,
    };
    const openDays = tally.present + tally.late + tally.absent + tally.halfDay;
    const pointsEarned =
      tally.present * presentPts + tally.halfDay * halfPts + tally.late * latePts;
    const maxPossible = Math.max(0, openDays * Math.max(presentPts, 0));
    const scorePct = maxPossible > 0 ? Number(((pointsEarned / maxPossible) * 100).toFixed(2)) : 0;
    return {
      enrollmentId: enrollment.id,
      student: enrollment.student,
      rollNumber: enrollment.rollNumber,
      classSection: enrollment.classSection,
      present: tally.present,
      late: tally.late,
      absent: tally.absent,
      halfDay: tally.halfDay,
      pointsEarned,
      maxPossible,
      scorePct,
    };
  });

  scores.sort((a, b) => b.scorePct - a.scorePct || b.pointsEarned - a.pointsEarned);

  return {
    session,
    config: {
      presentPoints: presentPts,
      halfDayPoints: halfPts,
      latePoints: latePts,
    },
    scores,
  };
}

export async function updateAttendancePointConfig(
  tenantId: string,
  input: { presentPoints: number; halfDayPoints: number; latePoints: number },
) {
  await prisma.tenantSetting.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
  await prisma.$executeRaw`
    UPDATE tenant_settings
    SET attendance_present_points = ${input.presentPoints},
        attendance_half_day_points = ${input.halfDayPoints},
        attendance_late_points = ${input.latePoints},
        updated_at = NOW()
    WHERE tenant_id = ${tenantId}
  `;
  return {
    presentPoints: input.presentPoints,
    halfDayPoints: input.halfDayPoints,
    latePoints: input.latePoints,
  };
}
