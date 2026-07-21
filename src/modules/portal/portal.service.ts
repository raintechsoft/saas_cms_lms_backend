import {
  AttendanceStatus,
  ExamStatus,
  HomeworkStatus,
  PassStatus,
  ProductMode,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { hasEntitlement } from "../tenants/tenant.service.js";
import { listStudentFees } from "../fees/fees.service.js";
import {
  currentEnrollment,
  resolveAccessibleStudents,
  type AccessibleStudent,
  type PortalViewer,
} from "./portal-access.js";
import { listPortalNotices } from "./portal-detail.service.js";

async function buildStudentSnapshot(
  tenantId: string,
  student: AccessibleStudent,
  productMode: ProductMode | null,
  meta: { relation: string | null; isPrimary: boolean },
) {
  const enrollment = currentEnrollment(student);
  const includeLms = hasEntitlement(productMode, "LMS");
  const includeCms = hasEntitlement(productMode, "CMS");
  if (!enrollment) {
    return {
      student: {
        id: student.id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        photoUrl: student.photoUrl,
        status: student.status,
        mobile: student.mobile,
        email: student.email,
        currentAddress: student.currentAddress,
      },
      relation: meta.relation,
      isPrimary: meta.isPrimary,
      enrollment: null,
      timetable: [],
      homework: [],
      attendance: { summary: null, recent: [] },
      exams: [],
      fees: null,
    };
  }

  const sessionId = enrollment.academicSessionId;
  const classSectionId = enrollment.classSectionId;
  const fromDate = new Date();
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);

  const [timetable, homeworkRows, attendanceRecords, examStudents, feeStatement] =
    await Promise.all([
      includeLms
        ? prisma.timetableEntry.findMany({
            where: tenantScope(tenantId, { academicSessionId: sessionId, classSectionId }),
            include: {
              classSubject: { include: { subject: true } },
              teacher: { select: { firstName: true, lastName: true } },
            },
            orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
          })
        : Promise.resolve([]),
      includeLms
        ? prisma.homework.findMany({
            where: tenantScope(tenantId, {
              academicSessionId: sessionId,
              classSectionId,
              status: HomeworkStatus.PUBLISHED,
            }),
            include: {
              classSubject: { include: { subject: true } },
              submissions: { where: { studentEnrollmentId: enrollment.id } },
            },
            orderBy: { submissionDate: "desc" },
            take: 30,
          })
        : Promise.resolve([]),
      prisma.attendanceRecord.findMany({
        where: tenantScope(tenantId, {
          studentEnrollment: { id: enrollment.id },
          attendanceDate: { gte: fromDate },
        }),
        orderBy: { attendanceDate: "desc" },
        take: 60,
      }),
      prisma.examStudent.findMany({
        where: tenantScope(tenantId, {
          studentEnrollmentId: enrollment.id,
          exam: { status: ExamStatus.PUBLISHED },
        }),
        include: {
          exam: { include: { examGroup: true } },
          marks: {
            include: {
              schedule: {
                include: { classSubject: { include: { subject: true } } },
              },
            },
          },
        },
      }),
      includeCms
        ? listStudentFees(tenantId, student.id, sessionId).catch(() => null)
        : Promise.resolve(null),
    ]);

  const attendanceCounts = attendanceRecords.reduce(
    (acc, record) => {
      acc.total += 1;
      if (record.status === AttendanceStatus.PRESENT) acc.present += 1;
      if (record.status === AttendanceStatus.LATE) acc.late += 1;
      if (record.status === AttendanceStatus.ABSENT) acc.absent += 1;
      if (record.status === AttendanceStatus.HALF_DAY) acc.halfDay += 1;
      if (record.status === AttendanceStatus.HOLIDAY) acc.holiday += 1;
      return acc;
    },
    { total: 0, present: 0, late: 0, absent: 0, halfDay: 0, holiday: 0 },
  );
  const counted = attendanceCounts.total - attendanceCounts.holiday;
  const attended =
    attendanceCounts.present + attendanceCounts.late + attendanceCounts.halfDay * 0.5;

  const exams = examStudents.map((examStudent) => {
    const maximumMarks = examStudent.marks.reduce(
      (sum, mark) => sum + Number(mark.schedule.maximumMarks),
      0,
    );
    const obtainedMarks = examStudent.marks.reduce(
      (sum, mark) => sum + Number(mark.marksObtained),
      0,
    );
    const failed = examStudent.marks.some(
      (mark) =>
        mark.isAbsent ||
        Number(mark.marksObtained) < Number(mark.schedule.minimumMarks),
    );
    return {
      examId: examStudent.examId,
      examName: examStudent.exam.name,
      groupName: examStudent.exam.examGroup.name,
      maximumMarks,
      obtainedMarks,
      percentage: maximumMarks
        ? Number(((obtainedMarks / maximumMarks) * 100).toFixed(2))
        : 0,
      passStatus: failed ? PassStatus.FAIL : PassStatus.PASS,
      subjects: examStudent.marks.map((mark) => ({
        subject: mark.schedule.classSubject.subject.name,
        marksObtained: Number(mark.marksObtained),
        maximumMarks: Number(mark.schedule.maximumMarks),
        isAbsent: mark.isAbsent,
      })),
    };
  });

  return {
    student: {
      id: student.id,
      admissionNumber: student.admissionNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      photoUrl: student.photoUrl,
      status: student.status,
      mobile: student.mobile,
      email: student.email,
      currentAddress: student.currentAddress,
      category: student.category?.name ?? null,
      house: student.house?.name ?? null,
    },
    relation: meta.relation,
    isPrimary: meta.isPrimary,
    enrollment: {
      id: enrollment.id,
      rollNumber: enrollment.rollNumber,
      session: enrollment.academicSession.name,
      className: enrollment.classSection.academicClass.name,
      section: enrollment.classSection.section.name,
      classTeacher: enrollment.classSection.classTeacher
        ? `${enrollment.classSection.classTeacher.firstName} ${enrollment.classSection.classTeacher.lastName}`
        : null,
    },
    timetable: timetable.map((entry) => ({
      id: entry.id,
      weekday: entry.weekday,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room,
      subject: entry.classSubject.subject.name,
      teacher: entry.teacher
        ? `${entry.teacher.firstName} ${entry.teacher.lastName}`
        : null,
    })),
    homework: homeworkRows.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      subject: item.classSubject.subject.name,
      homeworkDate: item.homeworkDate,
      submissionDate: item.submissionDate,
      attachmentUrl: item.attachmentUrl,
      studentEnrollmentId: enrollment.id,
      submission: item.submissions[0]
        ? {
            id: item.submissions[0].id,
            status: item.submissions[0].status,
            review: item.submissions[0].review,
            attempt: item.submissions[0].attempt,
          }
        : null,
    })),
    attendance: {
      summary: {
        total: attendanceCounts.total,
        present: attendanceCounts.present,
        late: attendanceCounts.late,
        absent: attendanceCounts.absent,
        halfDay: attendanceCounts.halfDay,
        holiday: attendanceCounts.holiday,
        percentage: counted ? Number(((attended / counted) * 100).toFixed(2)) : 0,
      },
      recent: attendanceRecords.slice(0, 15).map((record) => ({
        date: record.attendanceDate,
        status: record.status,
        periodKey: record.periodKey,
      })),
    },
    exams,
    fees: feeStatement
      ? {
          totals: feeStatement.totals,
          items: feeStatement.assignments.map((assignment) => ({
            name: assignment.feeMaster?.feeType?.name ?? "Fee",
            balance: assignment.totals.balance,
            paid: assignment.totals.paid,
            base: assignment.totals.base,
          })),
        }
      : null,
  };
}

export async function getPortalOverview(
  tenantId: string,
  viewer: PortalViewer,
  productMode: ProductMode | null = null,
) {
  const isStudent = viewer.roles.includes("STUDENT");
  const isParent = viewer.roles.includes("PARENT");
  if (!isStudent && !isParent) {
    throw new AppError(403, "Portal is available to students and parents", "PORTAL_FORBIDDEN");
  }
  const links = await resolveAccessibleStudents(tenantId, viewer);
  if (!links.length) {
    throw new AppError(
      404,
      isStudent
        ? "No student profile is linked to this account"
        : "No children are linked to this guardian account",
      "PORTAL_NO_STUDENTS",
    );
  }
  const children = await Promise.all(
    links.map((link) =>
      buildStudentSnapshot(tenantId, link.student, productMode, {
        relation: link.relation,
        isPrimary: link.isPrimary,
      }),
    ),
  );
  const notices = await listPortalNotices(
    tenantId,
    viewer,
    children[0]?.student.id,
  ).catch(() => []);

  return {
    role: isStudent ? "STUDENT" : "PARENT",
    canSubmitHomework: isStudent && hasEntitlement(productMode, "LMS"),
    productMode,
    notices: notices.slice(0, 5).map((notice) => ({
      id: notice.id,
      title: notice.title,
      publishedAt: notice.publishedAt,
      audience: notice.audience,
    })),
    children,
  };
}
