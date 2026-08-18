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

function mapStudentProfile(student: AccessibleStudent) {
  return {
    id: student.id,
    admissionNumber: student.admissionNumber,
    firstName: student.firstName,
    lastName: student.lastName,
    photoUrl: student.photoUrl,
    status: student.status,
    mobile: student.mobile,
    email: student.email,
    currentAddress: student.currentAddress,
    permanentAddress: student.permanentAddress,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth
      ? new Date(student.dateOfBirth).toISOString()
      : null,
    admissionDate: student.admissionDate
      ? new Date(student.admissionDate).toISOString()
      : null,
    bloodGroup: student.bloodGroup,
    nationality: student.nationality,
    religion: student.religion,
    caste: student.caste,
    category: student.category?.name ?? null,
    house: student.house?.name ?? null,
    fatherName: student.fatherName,
    fatherPhone: student.fatherPhone,
    fatherEmail: student.fatherEmail,
    fatherOccupation: student.fatherOccupation,
    motherName: student.motherName,
    motherPhone: student.motherPhone,
    motherEmail: student.motherEmail,
    motherOccupation: student.motherOccupation,
    guardianName: student.guardianName,
    guardianRelation: student.guardianRelation,
    guardianPhone: student.guardianPhone,
    guardianEmail: student.guardianEmail,
    guardianOccupation: student.guardianOccupation,
    admissionType: student.admissionType,
    transportOptIn: student.transportOptIn,
    transportRoute: student.transportRoute,
    transportStopName: student.transportStopName,
    transport: student.transportRouteRef
      ? {
          routeId: student.transportRouteRef.id,
          routeName: student.transportRouteRef.name,
          code: student.transportRouteRef.code,
          vehicleNumber: student.transportRouteRef.vehicleNumber,
          driverName: student.transportRouteRef.driverName,
          driverPhone: student.transportRouteRef.driverPhone,
          stopName: student.transportStopName,
        }
      : null,
    hostelOptIn: student.hostelOptIn,
    hostelRoom: student.hostelRoom,
    hostelBedId: student.hostelBedId,
    hostel: student.hostelRoomRef
      ? {
          roomId: student.hostelRoomRef.id,
          roomName: student.hostelRoomRef.name,
          blockId: student.hostelRoomRef.block.id,
          blockName: student.hostelRoomRef.block.name,
          bedId: student.hostelBedId,
          bedLabel: student.hostelBedRef?.label ?? null,
        }
      : null,
    additionalNotes: student.additionalNotes,
  };
}

async function buildStudentSnapshot(
  tenantId: string,
  student: AccessibleStudent,
  productMode: ProductMode | null,
  meta: { relation: string | null; isPrimary: boolean },
) {
  const enrollment = currentEnrollment(student);
  const includeLms = hasEntitlement(productMode, "LMS");
  const includeCms = hasEntitlement(productMode, "CMS");
  const includeHomework = Boolean(productMode);
  if (!enrollment) {
    return {
      student: mapStudentProfile(student),
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

  const emptySnapshot = {
    student: mapStudentProfile(student),
    relation: meta.relation,
    isPrimary: meta.isPrimary,
    enrollment: {
      id: enrollment.id,
      rollNumber: enrollment.rollNumber,
      session: enrollment.academicSession?.name ?? "",
      className: enrollment.classSection?.academicClass?.name ?? "",
      section: enrollment.classSection?.section?.name ?? "",
      classTeacher: enrollment.classSection.classTeacher
        ? `${enrollment.classSection.classTeacher.firstName} ${enrollment.classSection.classTeacher.lastName}`
        : null,
    },
    timetable: [] as Array<{
      id: string;
      weekday: string;
      startTime: string;
      endTime: string;
      room: string | null;
      subject: string;
      teacher: string | null;
    }>,
    homework: [] as Array<{
      id: string;
      title: string;
      description: string | null;
      subject: string;
      homeworkDate: Date;
      submissionDate: Date;
      attachmentUrl: string | null;
      studentEnrollmentId: string;
      submission: {
        id: string;
        status: string;
        review: string | null;
        attempt: number;
      } | null;
    }>,
    attendance: {
      summary: {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        halfDay: 0,
        holiday: 0,
        percentage: 0,
      },
      recent: [] as Array<{ date: Date; status: AttendanceStatus; periodKey: string | null }>,
    },
    exams: [] as Array<{
      examId: string;
      examName: string;
      groupName: string;
      examDate: string | null;
      publishedAt: string | null;
      maximumMarks: number;
      obtainedMarks: number;
      percentage: number;
      passStatus: PassStatus;
      subjects: Array<{
        subject: string;
        marksObtained: number;
        maximumMarks: number;
        isAbsent: boolean;
        examDate: string | null;
      }>;
    }>,
    fees: null as {
      totals: unknown;
      items: Array<{ name: string; balance: number; paid: number; base: number }>;
    } | null,
  };

  let timetable: any[] = [];
  let homeworkRows: any[] = [];
  let attendanceRecords: any[] = [];
  let examStudents: any[] = [];
  let feeStatement: Awaited<ReturnType<typeof listStudentFees>> | null = null;

  try {
    [timetable, homeworkRows, attendanceRecords, examStudents, feeStatement] =
      await Promise.all([
        includeLms
          ? prisma.timetableEntry
              .findMany({
                where: tenantScope(tenantId, { academicSessionId: sessionId, classSectionId }),
                include: {
                  classSubject: { include: { subject: true } },
                  teacher: { select: { firstName: true, lastName: true } },
                },
                orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
              })
              .catch((error) => {
                console.error("[portal/overview] timetable", error);
                return [];
              })
          : Promise.resolve([]),
        includeHomework
          ? prisma.homework
              .findMany({
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
              .catch((error) => {
                console.error("[portal/overview] homework", error);
                return [];
              })
          : Promise.resolve([]),
        prisma.attendanceRecord
          .findMany({
            where: tenantScope(tenantId, {
              studentEnrollment: { id: enrollment.id },
              attendanceDate: { gte: fromDate },
            }),
            orderBy: { attendanceDate: "desc" },
            take: 60,
          })
          .catch((error) => {
            console.error("[portal/overview] attendance", error);
            return [];
          }),
        prisma.examStudent
          .findMany({
            where: tenantScope(tenantId, {
              studentEnrollmentId: enrollment.id,
              showOnPortal: true,
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
          })
          .catch((error) => {
            console.error("[portal/overview] exams", error);
            return [];
          }),
        includeCms
          ? listStudentFees(tenantId, student.id, sessionId).catch((error) => {
              console.error("[portal/overview] fees", error);
              return null;
            })
          : Promise.resolve(null),
      ]);
  } catch (error) {
    console.error("[portal/overview] snapshot", error);
    return emptySnapshot;
  }

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

  const exams = examStudents.map((examStudent: any) => {
    const marks = (examStudent.marks ?? []) as any[];
    const maximumMarks = marks.reduce(
      (sum: number, mark: any) => sum + Number(mark.schedule?.maximumMarks ?? 0),
      0,
    );
    const obtainedMarks = marks.reduce(
      (sum: number, mark: any) => sum + Number(mark.marksObtained ?? 0),
      0,
    );
    const failed = marks.some(
      (mark: any) =>
        mark.isAbsent ||
        Number(mark.marksObtained) < Number(mark.schedule?.minimumMarks ?? 0),
    );
    const dates = marks
      .map((mark: any) => new Date(mark.schedule?.examDate).getTime())
      .filter((value: number) => Number.isFinite(value));
    const examDate =
      dates.length > 0
        ? new Date(Math.max(...dates)).toISOString()
        : examStudent.exam?.startDate
          ? new Date(examStudent.exam.startDate).toISOString()
          : examStudent.exam?.publishedAt
            ? new Date(examStudent.exam.publishedAt).toISOString()
            : null;
    return {
      examId: examStudent.examId,
      examName: examStudent.exam?.name ?? "Exam",
      groupName: examStudent.exam?.examGroup?.name ?? "Exam",
      examDate,
      publishedAt: examStudent.exam?.publishedAt
        ? new Date(examStudent.exam.publishedAt).toISOString()
        : null,
      maximumMarks,
      obtainedMarks,
      percentage: maximumMarks
        ? Number(((obtainedMarks / maximumMarks) * 100).toFixed(2))
        : 0,
      passStatus: failed ? PassStatus.FAIL : PassStatus.PASS,
      subjects: marks.map((mark: any) => ({
        subject: mark.schedule?.classSubject?.subject?.name ?? "Subject",
        marksObtained: Number(mark.marksObtained),
        maximumMarks: Number(mark.schedule?.maximumMarks ?? 0),
        isAbsent: mark.isAbsent,
        examDate: mark.schedule?.examDate
          ? new Date(mark.schedule.examDate).toISOString()
          : null,
      })),
    };
  });

  return {
    student: mapStudentProfile(student),
    relation: meta.relation,
    isPrimary: meta.isPrimary,
    enrollment: {
      id: enrollment.id,
      rollNumber: enrollment.rollNumber,
      session: enrollment.academicSession?.name ?? "",
      className: enrollment.classSection?.academicClass?.name ?? "",
      section: enrollment.classSection?.section?.name ?? "",
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
      subject: entry.classSubject?.subject?.name ?? "Period",
      teacher: entry.teacher
        ? `${entry.teacher.firstName} ${entry.teacher.lastName}`
        : null,
    })),
    homework: homeworkRows.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      subject: item.classSubject?.subject?.name ?? "Homework",
      homeworkDate: item.homeworkDate,
      submissionDate: item.submissionDate,
      attachmentUrl: item.attachmentUrl,
      studentEnrollmentId: enrollment.id,
      submission: item.submissions?.[0]
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
  let links: Awaited<ReturnType<typeof resolveAccessibleStudents>> = [];
  try {
    links = await resolveAccessibleStudents(tenantId, viewer);
  } catch (error) {
    console.error("[portal/overview] resolve students", error);
    throw new AppError(
      503,
      "Portal profile could not be loaded. Check student/guardian linking.",
      "PORTAL_OVERVIEW_UNAVAILABLE",
    );
  }
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
    links.map(async (link) => {
      try {
        return await buildStudentSnapshot(tenantId, link.student, productMode, {
          relation: link.relation,
          isPrimary: link.isPrimary,
        });
      } catch (error) {
        console.error("[portal/overview] child snapshot", error);
        return {
          student: mapStudentProfile(link.student),
          relation: link.relation,
          isPrimary: link.isPrimary,
          enrollment: null,
          timetable: [],
          homework: [],
          attendance: { summary: null, recent: [] },
          exams: [],
          fees: null,
        };
      }
    }),
  );
  const notices = await listPortalNotices(
    tenantId,
    viewer,
    children[0]?.student.id,
  ).catch(() => []);

  return {
    role: isStudent ? "STUDENT" : "PARENT",
    canSubmitHomework: isStudent && Boolean(productMode),
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
