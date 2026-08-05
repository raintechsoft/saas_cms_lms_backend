import {
  AttendanceStatus,
  AttendanceType,
  EnrollmentStatus,
  StaffAttendanceStatus,
  StaffStatus,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getAttendanceReport, parseMonthBounds } from "./attendance.service.js";

export type AttendancePackReportKey =
  | "daily_attendance"
  | "custom_attendance"
  | "remaining_class"
  | "student_summary"
  | "staff_summary"
  | "inout_time"
  | "period_wise"
  | "class_wise"
  | "frequently_absent"
  | "attendance_type";

export const ATTENDANCE_REPORTS: Array<{
  key: AttendancePackReportKey;
  label: string;
  description: string;
}> = [
  {
    key: "daily_attendance",
    label: "Daily Attendance Report",
    description: "Attendance records for a selected day",
  },
  {
    key: "custom_attendance",
    label: "Custom Attendance Report",
    description: "Filtered attendance records over a date range",
  },
  {
    key: "remaining_class",
    label: "Remaining Class Attendance Report",
    description: "Class sections with attendance not yet marked",
  },
  {
    key: "student_summary",
    label: "Student Attendance Summary",
    description: "Per-student present/absent/late totals and percentage",
  },
  {
    key: "staff_summary",
    label: "Staff Attendance Summary",
    description: "Staff present/absent/late counts for a month",
  },
  {
    key: "inout_time",
    label: "In/Out Time Attendance Report",
    description: "Attendance records with in and out times",
  },
  {
    key: "period_wise",
    label: "Periods wise Attendance Report",
    description: "Attendance counts grouped by period",
  },
  {
    key: "class_wise",
    label: "Class wise Attendance Report",
    description: "Aggregated attendance per class section",
  },
  {
    key: "frequently_absent",
    label: "Frequently Absent Report",
    description: "Students with absent/late/half-day count above threshold in date range",
  },
  {
    key: "attendance_type",
    label: "Attendance Type Report",
    description: "Status distribution by day-wise or period-wise attendance mode",
  },
];

function formatNowHhMm(date = new Date()): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function studentDisplayName(student: { firstName: string; lastName: string | null }) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function classSectionLabel(classSection: {
  academicClass: { name: string };
  section: { name: string };
}) {
  return `${classSection.academicClass.name} · ${classSection.section.name}`;
}

function resolveScanStatus(
  scanTime: string,
  classTimes: { inTime: string | null; halfDayTime: string | null },
): AttendanceStatus {
  if (classTimes.halfDayTime && scanTime >= classTimes.halfDayTime) {
    return AttendanceStatus.HALF_DAY;
  }
  if (classTimes.inTime && scanTime > classTimes.inTime) {
    return AttendanceStatus.LATE;
  }
  return AttendanceStatus.PRESENT;
}

export async function scanAttendance(
  tenantId: string,
  userId: string,
  input: {
    code: string;
    mode: "IN" | "OUT";
    deviceType?: "BARCODE" | "RFID" | "BIOMETRIC";
    classSectionId?: string;
    attendanceDate?: Date;
    periodKey?: string;
    scanTime?: string;
  },
) {
  const code = input.code.trim();
  if (!code) {
    throw new AppError(400, "Scan code is required", "CODE_REQUIRED");
  }

  const attendanceDate = input.attendanceDate ?? (() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  })();
  const scanTime = input.scanTime?.trim() || formatNowHhMm();

  const [setting, currentSession] = await Promise.all([
    prisma.tenantSetting.findUnique({ where: { tenantId } }),
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { isCurrent: true }),
    }),
  ]);
  if (!currentSession) {
    throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
  }

  let student = await prisma.student.findFirst({
    where: tenantScope(tenantId, {
      admissionNumber: { equals: code, mode: "insensitive" as const },
    }),
  });
  if (!student) {
    const generated = await prisma.generatedDocument.findFirst({
      where: tenantScope(tenantId, {
        barcodeValue: { equals: code, mode: "insensitive" as const },
        studentId: { not: null },
      }),
      select: { studentId: true },
    });
    if (generated?.studentId) {
      student = await prisma.student.findFirst({
        where: tenantScope(tenantId, { id: generated.studentId }),
      });
    }
  }
  if (!student) {
    throw new AppError(404, "Student not found for scan code", "STUDENT_NOT_FOUND");
  }

  const enrollmentWhere = tenantScope(tenantId, {
    studentId: student.id,
    academicSessionId: currentSession.id,
    status: EnrollmentStatus.ACTIVE,
    ...(input.classSectionId ? { classSectionId: input.classSectionId } : {}),
  });
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: enrollmentWhere,
    include: {
      classSection: { include: { academicClass: true, section: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });
  if (!enrollment) {
    throw new AppError(400, "No active enrolment found for student", "INVALID_ENROLLMENT");
  }

  const periodKey =
    setting?.attendanceType === AttendanceType.PERIOD_WISE
      ? input.periodKey?.trim() || "PERIOD-1"
      : "DAY";
  if (setting?.attendanceType === AttendanceType.PERIOD_WISE && !periodKey) {
    throw new AppError(400, "Period is required for period-wise attendance", "PERIOD_REQUIRED");
  }

  const academicClass = enrollment.classSection.academicClass;
  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      tenantId_studentEnrollmentId_attendanceDate_periodKey: {
        tenantId,
        studentEnrollmentId: enrollment.id,
        attendanceDate,
        periodKey,
      },
    },
  });

  let status = existing?.status ?? AttendanceStatus.PRESENT;
  let inTime = existing?.inTime ?? null;
  let outTime = existing?.outTime ?? null;

  if (input.mode === "IN") {
    inTime = scanTime;
    status = resolveScanStatus(scanTime, {
      inTime: academicClass.inTime,
      halfDayTime: academicClass.halfDayTime,
    });
  } else {
    outTime = scanTime;
    if (!existing) {
      status = AttendanceStatus.PRESENT;
    }
  }

  const noteParts = [
    existing?.note,
    input.deviceType ? `scan:${input.deviceType}` : null,
  ].filter(Boolean);

  const record = await prisma.attendanceRecord.upsert({
    where: {
      tenantId_studentEnrollmentId_attendanceDate_periodKey: {
        tenantId,
        studentEnrollmentId: enrollment.id,
        attendanceDate,
        periodKey,
      },
    },
    create: {
      tenantId,
      studentEnrollmentId: enrollment.id,
      academicSessionId: currentSession.id,
      classSectionId: enrollment.classSectionId,
      attendanceDate,
      periodKey,
      status,
      inTime,
      outTime,
      note: noteParts.length ? noteParts.join(" | ") : null,
      markedById: userId,
    },
    update: {
      status,
      inTime,
      outTime,
      note: noteParts.length ? noteParts.join(" | ") : existing?.note,
      markedById: userId,
    },
  });

  return {
    enrollmentId: enrollment.id,
    studentId: student.id,
    studentName: studentDisplayName(student),
    admissionNumber: student.admissionNumber,
    classSectionId: enrollment.classSectionId,
    classSection: classSectionLabel(enrollment.classSection),
    mode: input.mode,
    periodKey: record.periodKey,
    status: record.status,
    inTime: record.inTime,
    outTime: record.outTime,
    attendanceDate: record.attendanceDate,
  };
}

export function getAttendanceReportCatalog() {
  return ATTENDANCE_REPORTS;
}

export async function runAttendancePackReport(
  tenantId: string,
  query: {
    reportKey: AttendancePackReportKey;
    date?: Date;
    fromDate?: Date;
    toDate?: Date;
    classSectionId?: string;
    periodKey?: string;
    month?: string;
    status?: AttendanceStatus;
    threshold?: number;
  },
) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  const setting = await prisma.tenantSetting.findUnique({ where: { tenantId } });
  const reportMeta = ATTENDANCE_REPORTS.find((item) => item.key === query.reportKey);
  if (!reportMeta) {
    throw new AppError(400, "Unknown attendance report", "INVALID_REPORT");
  }

  const recordInclude = {
    studentEnrollment: {
      include: {
        student: true,
        classSection: { include: { academicClass: true, section: true } },
      },
    },
  } as const;

  if (query.reportKey === "daily_attendance") {
    const date = query.date ?? query.fromDate;
    if (!date) {
      throw new AppError(400, "Date is required", "DATE_REQUIRED");
    }
    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        ...(currentSession ? { academicSessionId: currentSession.id } : {}),
        attendanceDate: date,
        ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
        ...(query.periodKey ? { periodKey: query.periodKey } : {}),
        ...(query.status ? { status: query.status } : {}),
      }),
      include: recordInclude,
      orderBy: [
        { classSectionId: "asc" },
        { studentEnrollment: { rollNumber: "asc" } },
      ],
    });
    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      session: currentSession,
      date,
      summary: { total: records.length },
      rows: records.map((record) => ({
        id: record.id,
        date: record.attendanceDate.toISOString().slice(0, 10),
        periodKey: record.periodKey,
        status: record.status,
        inTime: record.inTime,
        outTime: record.outTime,
        studentName: studentDisplayName(record.studentEnrollment.student),
        admissionNumber: record.studentEnrollment.student.admissionNumber,
        classSection: classSectionLabel(record.studentEnrollment.classSection),
      })),
    };
  }

  if (query.reportKey === "custom_attendance") {
    const fromDate = query.fromDate ?? query.date;
    const toDate = query.toDate ?? query.fromDate ?? query.date;
    if (!fromDate || !toDate) {
      throw new AppError(400, "Date range is required", "DATE_RANGE_REQUIRED");
    }
    if (toDate < fromDate) {
      throw new AppError(400, "End date must be on or after start date", "INVALID_DATES");
    }
    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        ...(currentSession ? { academicSessionId: currentSession.id } : {}),
        attendanceDate: { gte: fromDate, lte: toDate },
        ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
        ...(query.periodKey ? { periodKey: query.periodKey } : {}),
        ...(query.status ? { status: query.status } : {}),
      }),
      include: recordInclude,
      orderBy: [
        { attendanceDate: "asc" },
        { studentEnrollment: { rollNumber: "asc" } },
      ],
    });
    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      session: currentSession,
      fromDate,
      toDate,
      summary: { total: records.length },
      rows: records.map((record) => ({
        id: record.id,
        date: record.attendanceDate.toISOString().slice(0, 10),
        periodKey: record.periodKey,
        status: record.status,
        inTime: record.inTime,
        outTime: record.outTime,
        note: record.note,
        studentName: studentDisplayName(record.studentEnrollment.student),
        admissionNumber: record.studentEnrollment.student.admissionNumber,
        classSection: classSectionLabel(record.studentEnrollment.classSection),
      })),
    };
  }

  if (query.reportKey === "remaining_class") {
    const date = query.date ?? query.fromDate;
    if (!date) {
      throw new AppError(400, "Date is required", "DATE_REQUIRED");
    }
    if (!currentSession) {
      throw new AppError(400, "Academic session is required", "SESSION_REQUIRED");
    }
    const periodKey =
      setting?.attendanceType === AttendanceType.PERIOD_WISE
        ? query.periodKey?.trim() || "PERIOD-1"
        : "DAY";

    const classSections = await prisma.classSection.findMany({
      where: tenantScope(tenantId, { academicSessionId: currentSession.id }),
      include: {
        academicClass: { select: { id: true, name: true, sortOrder: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [
        { academicClass: { sortOrder: "asc" } },
        { section: { name: "asc" } },
      ],
    });
    const marked = await prisma.attendanceRecord.groupBy({
      by: ["classSectionId"],
      where: tenantScope(tenantId, {
        academicSessionId: currentSession.id,
        attendanceDate: date,
        periodKey,
      }),
      _count: { _all: true },
    });
    const markedIds = new Set(marked.map((item) => item.classSectionId));
    const rows = classSections
      .filter((item) => !markedIds.has(item.id))
      .map((item) => ({
        classSectionId: item.id,
        classSection: classSectionLabel(item),
        academicClassId: item.academicClass.id,
        sectionId: item.section.id,
        periodKey,
        status: "not_marked" as const,
      }));
    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      session: currentSession,
      date,
      periodKey,
      summary: { remaining: rows.length, totalClasses: classSections.length },
      rows,
    };
  }

  if (query.reportKey === "student_summary") {
    const fromDate = query.fromDate ?? query.date ?? currentSession?.startDate;
    const toDate = query.toDate ?? query.date ?? currentSession?.endDate ?? new Date();
    if (!fromDate) {
      throw new AppError(400, "Date range is required", "DATE_RANGE_REQUIRED");
    }
    const report = await getAttendanceReport(tenantId, {
      fromDate,
      toDate,
      classSectionId: query.classSectionId,
      periodKey: query.periodKey,
    });
    const threshold = query.threshold;
    const summaries = threshold == null
      ? report.summaries
      : report.summaries.filter((item) => item.percentage < threshold);
    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      session: currentSession,
      fromDate,
      toDate,
      summary: { students: summaries.length },
      rows: summaries.map((item) => ({
        studentId: item.student.id,
        studentName: studentDisplayName(item.student),
        admissionNumber: item.student.admissionNumber,
        present: item.present,
        late: item.late,
        absent: item.absent,
        halfDay: item.halfDay,
        holiday: item.holiday,
        total: item.total,
        percentage: item.percentage,
      })),
      records: report.records,
    };
  }

  if (query.reportKey === "staff_summary") {
    const monthSource = query.month
      ? parseMonthBounds(query.month)
      : query.date
        ? {
            start: new Date(Date.UTC(query.date.getUTCFullYear(), query.date.getUTCMonth(), 1)),
            end: new Date(Date.UTC(query.date.getUTCFullYear(), query.date.getUTCMonth() + 1, 0)),
          }
        : (() => {
            const now = new Date();
            return {
              start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
              end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
            };
          })();

    const [staff, records] = await Promise.all([
      prisma.staffProfile.findMany({
        where: tenantScope(tenantId, { status: StaffStatus.ACTIVE }),
        include: {
          user: { select: { firstName: true, lastName: true } },
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy: { employeeNumber: "asc" },
      }),
      prisma.staffAttendance.findMany({
        where: tenantScope(tenantId, {
          attendanceDate: { gte: monthSource.start, lte: monthSource.end },
        }),
        select: { staffId: true, status: true },
      }),
    ]);

    const counts = new Map<
      string,
      { present: number; late: number; absent: number; halfDay: number; holiday: number }
    >();
    for (const record of records) {
      const current = counts.get(record.staffId) ?? {
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        holiday: 0,
      };
      if (record.status === StaffAttendanceStatus.PRESENT) current.present += 1;
      if (record.status === StaffAttendanceStatus.LATE) current.late += 1;
      if (record.status === StaffAttendanceStatus.ABSENT) current.absent += 1;
      if (record.status === StaffAttendanceStatus.HALF_DAY) current.halfDay += 1;
      if (record.status === StaffAttendanceStatus.HOLIDAY) current.holiday += 1;
      counts.set(record.staffId, current);
    }

    const rows = staff.map((item) => {
      const tally = counts.get(item.id) ?? {
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        holiday: 0,
      };
      return {
        staffId: item.id,
        employeeNumber: item.employeeNumber,
        staffName: studentDisplayName(item.user),
        department: item.department?.name ?? null,
        designation: item.designation?.name ?? null,
        present: tally.present,
        late: tally.late,
        absent: tally.absent,
        halfDay: tally.halfDay,
        holiday: tally.holiday,
      };
    });

    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      month: monthSource.start.toISOString().slice(0, 7),
      summary: { staff: rows.length },
      rows,
    };
  }

  if (query.reportKey === "inout_time") {
    const fromDate = query.fromDate ?? query.date;
    const toDate = query.toDate ?? query.fromDate ?? query.date;
    if (!fromDate || !toDate) {
      throw new AppError(400, "Date range is required", "DATE_RANGE_REQUIRED");
    }
    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        ...(currentSession ? { academicSessionId: currentSession.id } : {}),
        attendanceDate: { gte: fromDate, lte: toDate },
        ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
        ...(query.periodKey ? { periodKey: query.periodKey } : {}),
      }),
      include: recordInclude,
      orderBy: [
        { attendanceDate: "asc" },
        { studentEnrollment: { rollNumber: "asc" } },
      ],
    });
    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      session: currentSession,
      fromDate,
      toDate,
      summary: { total: records.length },
      rows: records.map((record) => ({
        id: record.id,
        date: record.attendanceDate.toISOString().slice(0, 10),
        periodKey: record.periodKey,
        status: record.status,
        inTime: record.inTime,
        outTime: record.outTime,
        studentName: studentDisplayName(record.studentEnrollment.student),
        admissionNumber: record.studentEnrollment.student.admissionNumber,
        classSection: classSectionLabel(record.studentEnrollment.classSection),
      })),
    };
  }

  if (query.reportKey === "period_wise") {
    const fromDate = query.fromDate ?? query.date;
    const toDate = query.toDate ?? query.fromDate ?? query.date;
    if (!fromDate || !toDate) {
      throw new AppError(400, "Date range is required", "DATE_RANGE_REQUIRED");
    }
    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        ...(currentSession ? { academicSessionId: currentSession.id } : {}),
        attendanceDate: { gte: fromDate, lte: toDate },
        ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
      }),
      select: { periodKey: true, status: true },
    });
    const byPeriod = new Map<
      string,
      {
        periodKey: string;
        present: number;
        late: number;
        absent: number;
        halfDay: number;
        holiday: number;
        total: number;
      }
    >();
    for (const record of records) {
      const item = byPeriod.get(record.periodKey) ?? {
        periodKey: record.periodKey,
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        holiday: 0,
        total: 0,
      };
      item.total += 1;
      if (record.status === AttendanceStatus.PRESENT) item.present += 1;
      if (record.status === AttendanceStatus.LATE) item.late += 1;
      if (record.status === AttendanceStatus.ABSENT) item.absent += 1;
      if (record.status === AttendanceStatus.HALF_DAY) item.halfDay += 1;
      if (record.status === AttendanceStatus.HOLIDAY) item.holiday += 1;
      byPeriod.set(record.periodKey, item);
    }
    const rows = [...byPeriod.values()].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      session: currentSession,
      fromDate,
      toDate,
      summary: { periods: rows.length, total: records.length },
      rows,
    };
  }

  if (query.reportKey === "frequently_absent") {
    const threshold = query.threshold ?? 3;
    const toDate = query.toDate ?? query.date ?? new Date();
    const fromDate =
      query.fromDate ??
      query.date ??
      (() => {
        const d = new Date(toDate);
        d.setUTCDate(d.getUTCDate() - 6);
        return d;
      })();
    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        ...(currentSession ? { academicSessionId: currentSession.id } : {}),
        attendanceDate: { gte: fromDate, lte: toDate },
        status: {
          in: [AttendanceStatus.ABSENT, AttendanceStatus.LATE, AttendanceStatus.HALF_DAY],
        },
        ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
        ...(query.periodKey ? { periodKey: query.periodKey } : {}),
      }),
      include: recordInclude,
    });
    const byEnrollment = new Map<
      string,
      {
        studentName: string;
        admissionNumber: string;
        classSection: string;
        absent: number;
        late: number;
        halfDay: number;
        totalIssues: number;
      }
    >();
    for (const record of records) {
      const key = record.studentEnrollmentId;
      const row = byEnrollment.get(key) ?? {
        studentName: studentDisplayName(record.studentEnrollment.student),
        admissionNumber: record.studentEnrollment.student.admissionNumber,
        classSection: classSectionLabel(record.studentEnrollment.classSection),
        absent: 0,
        late: 0,
        halfDay: 0,
        totalIssues: 0,
      };
      if (record.status === AttendanceStatus.ABSENT) row.absent += 1;
      if (record.status === AttendanceStatus.LATE) row.late += 1;
      if (record.status === AttendanceStatus.HALF_DAY) row.halfDay += 1;
      row.totalIssues = row.absent + row.late + row.halfDay;
      byEnrollment.set(key, row);
    }
    const rows = [...byEnrollment.values()]
      .filter((row) => row.totalIssues >= threshold)
      .sort((a, b) => b.totalIssues - a.totalIssues);
    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      session: currentSession,
      fromDate,
      toDate,
      summary: { students: rows.length, threshold },
      rows,
    };
  }

  if (query.reportKey === "attendance_type") {
    const fromDate = query.fromDate ?? query.date ?? currentSession?.startDate;
    const toDate = query.toDate ?? query.date ?? currentSession?.endDate ?? new Date();
    if (!fromDate) {
      throw new AppError(400, "Date range is required", "DATE_RANGE_REQUIRED");
    }
    const records = await prisma.attendanceRecord.findMany({
      where: tenantScope(tenantId, {
        ...(currentSession ? { academicSessionId: currentSession.id } : {}),
        attendanceDate: { gte: fromDate, lte: toDate },
        ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
      }),
      select: { status: true, periodKey: true, attendanceDate: true },
    });
    const attendanceMode = setting?.attendanceType ?? AttendanceType.DAY_WISE;
    const isPeriodWise = attendanceMode === AttendanceType.PERIOD_WISE;
    const byBucket = new Map<
      string,
      {
        bucket: string;
        present: number;
        late: number;
        absent: number;
        halfDay: number;
        holiday: number;
        total: number;
      }
    >();
    for (const record of records) {
      const bucket = isPeriodWise
        ? record.periodKey
        : record.attendanceDate.toISOString().slice(0, 10);
      const row = byBucket.get(bucket) ?? {
        bucket,
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        holiday: 0,
        total: 0,
      };
      row.total += 1;
      if (record.status === AttendanceStatus.PRESENT) row.present += 1;
      if (record.status === AttendanceStatus.LATE) row.late += 1;
      if (record.status === AttendanceStatus.ABSENT) row.absent += 1;
      if (record.status === AttendanceStatus.HALF_DAY) row.halfDay += 1;
      if (record.status === AttendanceStatus.HOLIDAY) row.holiday += 1;
      byBucket.set(bucket, row);
    }
    const statusTotals = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.status] = (acc[record.status] ?? 0) + 1;
      return acc;
    }, {});
    const rows = [...byBucket.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
    return {
      reportKey: query.reportKey,
      title: reportMeta.label,
      session: currentSession,
      fromDate,
      toDate,
      attendanceMode,
      summary: { total: records.length, buckets: rows.length, ...statusTotals },
      rows,
    };
  }

  // class_wise
  const fromDate = query.fromDate ?? query.date;
  const toDate = query.toDate ?? query.fromDate ?? query.date;
  if (!fromDate || !toDate) {
    throw new AppError(400, "Date range is required", "DATE_RANGE_REQUIRED");
  }
  const records = await prisma.attendanceRecord.findMany({
    where: tenantScope(tenantId, {
      ...(currentSession ? { academicSessionId: currentSession.id } : {}),
      attendanceDate: { gte: fromDate, lte: toDate },
      ...(query.classSectionId ? { classSectionId: query.classSectionId } : {}),
      ...(query.periodKey ? { periodKey: query.periodKey } : {}),
    }),
    include: {
      classSection: { include: { academicClass: true, section: true } },
    },
  });
  const byClass = new Map<
    string,
    {
      classSectionId: string;
      classSection: string;
      present: number;
      late: number;
      absent: number;
      halfDay: number;
      holiday: number;
      total: number;
    }
  >();
  for (const record of records) {
    const item = byClass.get(record.classSectionId) ?? {
      classSectionId: record.classSectionId,
      classSection: classSectionLabel(record.classSection),
      present: 0,
      late: 0,
      absent: 0,
      halfDay: 0,
      holiday: 0,
      total: 0,
    };
    item.total += 1;
    if (record.status === AttendanceStatus.PRESENT) item.present += 1;
    if (record.status === AttendanceStatus.LATE) item.late += 1;
    if (record.status === AttendanceStatus.ABSENT) item.absent += 1;
    if (record.status === AttendanceStatus.HALF_DAY) item.halfDay += 1;
    if (record.status === AttendanceStatus.HOLIDAY) item.holiday += 1;
    byClass.set(record.classSectionId, item);
  }
  const rows = [...byClass.values()]
    .map((item) => {
      const counted = item.total - item.holiday;
      const attended = item.present + item.late + item.halfDay * 0.5;
      return {
        ...item,
        percentage: counted ? Math.round((attended / counted) * 10000) / 100 : 0,
      };
    })
    .sort((a, b) => a.classSection.localeCompare(b.classSection));

  return {
    reportKey: query.reportKey,
    title: reportMeta.label,
    session: currentSession,
    fromDate,
    toDate,
    summary: { classes: rows.length, total: records.length },
    rows,
  };
}
