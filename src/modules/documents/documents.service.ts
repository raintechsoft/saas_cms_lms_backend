import { DocumentTemplateType, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getExamResults } from "../exams/exams.service.js";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function listDocumentTemplates(
  tenantId: string,
  type?: DocumentTemplateType,
) {
  return prisma.documentTemplate.findMany({
    where: tenantScope(tenantId, type ? { type } : {}),
    include: { _count: { select: { documents: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createDocumentTemplate(
  tenantId: string,
  input: {
    type: DocumentTemplateType;
    name: string;
    backgroundUrl?: string | null;
    width: number;
    height: number;
    config: Prisma.InputJsonValue;
  },
) {
  return prisma.documentTemplate.create({ data: { tenantId, ...input } });
}

export async function updateDocumentTemplate(
  tenantId: string,
  templateId: string,
  input: {
    name?: string;
    backgroundUrl?: string | null;
    width?: number;
    height?: number;
    config?: Prisma.InputJsonValue;
    isActive?: boolean;
  },
) {
  const template = await prisma.documentTemplate.findFirst({
    where: tenantScope(tenantId, { id: templateId }),
  });
  if (!template) throw new AppError(404, "Document template not found", "TEMPLATE_NOT_FOUND");
  return prisma.documentTemplate.update({ where: { id: templateId }, data: input });
}

export async function deleteDocumentTemplate(tenantId: string, templateId: string) {
  const template = await prisma.documentTemplate.findFirst({
    where: tenantScope(tenantId, { id: templateId }),
    include: { _count: { select: { documents: true } } },
  });
  if (!template) throw new AppError(404, "Document template not found", "TEMPLATE_NOT_FOUND");
  // Generated documents keep a Restrict FK to their template, so a template
  // that has already been used is archived instead of hard-deleted.
  if (template._count.documents > 0) {
    await prisma.documentTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });
    return { deleted: false, deactivated: true };
  }
  await prisma.documentTemplate.delete({ where: { id: templateId } });
  return { deleted: true, deactivated: false };
}

export async function generateDocument(
  tenantId: string,
  generatedById: string,
  input: {
    templateId: string;
    studentId?: string;
    staffId?: string;
    examId?: string;
    barcodeValue?: string | null;
    payload?: Prisma.InputJsonValue;
  },
) {
  const template = await prisma.documentTemplate.findFirst({
    where: tenantScope(tenantId, { id: input.templateId, isActive: true }),
  });
  if (!template) throw new AppError(404, "Active template not found", "TEMPLATE_NOT_FOUND");
  if (!input.studentId && !input.staffId) {
    throw new AppError(400, "A student or staff member is required", "DOCUMENT_TARGET_REQUIRED");
  }
  if (input.studentId && input.staffId) {
    throw new AppError(400, "Choose either a student or staff member", "MULTIPLE_DOCUMENT_TARGETS");
  }
  const [student, staff, exam] = await Promise.all([
    input.studentId
      ? prisma.student.findFirst({
          where: tenantScope(tenantId, { id: input.studentId }),
          include: {
            enrollments: {
              include: {
                academicSession: true,
                classSection: { include: { academicClass: true, section: true } },
              },
              orderBy: { enrolledAt: "desc" },
              take: 1,
            },
          },
        })
      : null,
    input.staffId
      ? prisma.staffProfile.findFirst({
          where: tenantScope(tenantId, { id: input.staffId }),
          include: { user: true, department: true, designation: true },
        })
      : null,
    input.examId
      ? prisma.exam.findFirst({
          where: tenantScope(tenantId, { id: input.examId }),
          include: { examGroup: true },
        })
      : null,
  ]);
  if (input.studentId && !student) {
    throw new AppError(400, "Student is invalid", "INVALID_STUDENT");
  }
  if (input.staffId && !staff) {
    throw new AppError(400, "Staff member is invalid", "INVALID_STAFF");
  }
  if (input.examId && !exam) {
    throw new AppError(400, "Exam is invalid", "INVALID_EXAM");
  }
  if (
    (template.type === DocumentTemplateType.ADMIT_CARD ||
      template.type === DocumentTemplateType.MARKSHEET) &&
    (!student || !exam)
  ) {
    throw new AppError(
      400,
      "Exam documents require a student and exam",
      "EXAM_DOCUMENT_TARGET_REQUIRED",
    );
  }
  let result: unknown = null;
  let marksheetTokens: Record<string, unknown> | null = null;
  let admitSchedule: Array<{
    subject: string;
    examDate: string;
    startTime: string;
    endTime: string;
    room: string | null;
  }> = [];
  let admitMeta: {
    rollNumber: string | null;
    classLabel: string;
    examName: string;
    examGroupName: string;
  } | null = null;
  if (template.type === DocumentTemplateType.ADMIT_CARD && student && exam) {
    const examStudent = await prisma.examStudent.findFirst({
      where: tenantScope(tenantId, {
        examId: exam.id,
        studentEnrollment: { studentId: student.id },
      }),
      include: {
        studentEnrollment: {
          include: {
            classSection: { include: { academicClass: true, section: true } },
          },
        },
      },
    });
    if (!examStudent) {
      throw new AppError(400, "Student is not assigned to this exam", "STUDENT_NOT_IN_EXAM");
    }
    const classSectionId = examStudent.studentEnrollment.classSectionId;
    const schedules = await prisma.examSchedule.findMany({
      where: tenantScope(tenantId, { examId: exam.id, classSectionId }),
      include: { classSubject: { include: { subject: true } } },
      orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
    });
    admitSchedule = schedules.map((schedule) => ({
      subject: schedule.classSubject.subject.name,
      examDate: schedule.examDate.toISOString().slice(0, 10),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room,
    }));
    const cs = examStudent.studentEnrollment.classSection;
    admitMeta = {
      rollNumber: examStudent.rollNumber,
      classLabel: `${cs.academicClass.name} - ${cs.section.name}`,
      examName: exam.name,
      examGroupName: exam.examGroup.name,
    };
  }
  if (template.type === DocumentTemplateType.MARKSHEET && student && exam) {
    const report = await getExamResults(tenantId, exam.id);
    const studentResult = report.results.find((item) => item.student.id === student.id) ?? null;
    if (!studentResult) {
      throw new AppError(400, "Student is not assigned to this exam", "STUDENT_NOT_IN_EXAM");
    }
    result = studentResult;
    const subjectRows =
      studentResult.subjects?.length > 0
        ? studentResult.subjects
        : (studentResult.marks ?? []).map((mark) => ({
            name: mark.schedule.classSubject.subject.name,
            obtainedMarks: Number(mark.marksObtained),
            maximumMarks: Number(mark.schedule.maximumMarks),
            isAbsent: mark.isAbsent,
            linked: false,
            parts: undefined as
              | Array<{
                  name: string;
                  obtainedMarks: number;
                  maximumMarks: number;
                  isAbsent: boolean;
                }>
              | undefined,
            bifurcationColumns: undefined as number | undefined,
          }));

    const tableHtml = [
      `<table class="marks-table"><thead><tr><th>Subject</th><th>Obtained</th><th>Maximum</th></tr></thead><tbody>`,
      ...subjectRows.map(
        (row) =>
          `<tr><td>${escapeHtml(row.name)}</td><td>${
            row.isAbsent ? "Absent" : row.obtainedMarks
          }</td><td>${row.maximumMarks}</td></tr>`,
      ),
      `</tbody></table>`,
    ].join("");

    const linkedRows = subjectRows.filter((row) => "linked" in row && row.linked);
    const table1Rows = linkedRows.length > 0 ? linkedRows : subjectRows.filter((row) => row.parts);
    const table1Html =
      table1Rows.length > 0
        ? [
            `<table class="marks-table marks-table-bifurcated"><thead><tr><th>Subject</th><th>Components</th><th>Total</th></tr></thead><tbody>`,
            ...table1Rows.map((row) => {
              const parts =
                row.parts?.map(
                  (part) =>
                    `${escapeHtml(part.name)}: ${
                      part.isAbsent ? "Absent" : part.obtainedMarks
                    }/${part.maximumMarks}`,
                ) ?? [];
              const columns = Math.max(1, Number(row.bifurcationColumns ?? parts.length) || 1);
              return `<tr><td>${escapeHtml(row.name)}</td><td data-columns="${columns}">${
                parts.join(" · ") || "—"
              }</td><td>${row.isAbsent ? "Absent" : `${row.obtainedMarks}/${row.maximumMarks}`}</td></tr>`;
            }),
            `</tbody></table>`,
          ].join("")
        : tableHtml;

    const ranked = [...report.results].sort((a, b) => {
      if (a.gpa != null || b.gpa != null) return (b.gpa ?? 0) - (a.gpa ?? 0);
      return b.obtainedMarks - a.obtainedMarks;
    });
    const topStudents = ranked.slice(0, Math.min(10, ranked.length)).map((item, index) => ({
      rank: index + 1,
      name: `${item.student.firstName} ${item.student.lastName ?? ""}`.trim(),
      admissionNumber: item.student.admissionNumber,
      obtainedMarks: item.obtainedMarks,
      maximumMarks: item.maximumMarks,
      percentage: item.percentage,
      gpa: item.gpa,
      grade: item.grade,
    }));
    const top10Html = [
      `<table class="marks-table"><thead><tr><th>#</th><th>Student</th><th>Score</th><th>%</th></tr></thead><tbody>`,
      ...topStudents.map(
        (item) =>
          `<tr><td>${item.rank}</td><td>${escapeHtml(item.name)}</td><td>${
            item.gpa != null ? `GPA ${item.gpa}` : `${item.obtainedMarks}/${item.maximumMarks}`
          }</td><td>${item.percentage}</td></tr>`,
      ),
      `</tbody></table>`,
    ].join("");

    const classAverage =
      report.results.length > 0
        ? Number(
            (
              report.results.reduce((sum, item) => sum + item.obtainedMarks, 0) /
              report.results.length
            ).toFixed(2),
          )
        : 0;
    const classAveragePct =
      report.results.length > 0
        ? Number(
            (
              report.results.reduce((sum, item) => sum + item.percentage, 0) /
              report.results.length
            ).toFixed(2),
          )
        : 0;
    const topScore = ranked[0];
    const comparative = {
      student: {
        name: `${studentResult.student.firstName} ${studentResult.student.lastName ?? ""}`.trim(),
        obtainedMarks: studentResult.obtainedMarks,
        percentage: studentResult.percentage,
        gpa: studentResult.gpa,
        grade: studentResult.grade,
        rank: studentResult.rank,
      },
      classAverageMarks: classAverage,
      classAveragePercentage: classAveragePct,
      topScore: topScore
        ? {
            name: `${topScore.student.firstName} ${topScore.student.lastName ?? ""}`.trim(),
            obtainedMarks: topScore.obtainedMarks,
            percentage: topScore.percentage,
            gpa: topScore.gpa,
          }
        : null,
    };
    const comparativeHtml = [
      `<table class="marks-table"><tbody>`,
      `<tr><td>Student</td><td>${escapeHtml(comparative.student.name)} — ${
        comparative.student.gpa != null
          ? `GPA ${comparative.student.gpa}`
          : `${comparative.student.obtainedMarks} (${comparative.student.percentage}%)`
      }</td></tr>`,
      `<tr><td>Class average</td><td>${comparative.classAverageMarks} (${comparative.classAveragePercentage}%)</td></tr>`,
      `<tr><td>Top score</td><td>${
        comparative.topScore
          ? `${escapeHtml(comparative.topScore.name)} — ${
              comparative.topScore.gpa != null
                ? `GPA ${comparative.topScore.gpa}`
                : `${comparative.topScore.obtainedMarks} (${comparative.topScore.percentage}%)`
            }`
          : "—"
      }</td></tr>`,
      `</tbody></table>`,
    ].join("");

    marksheetTokens = {
      table: tableHtml,
      table1: table1Html,
      top_10_students: top10Html,
      comparative_analysis: comparativeHtml,
      structured: {
        table: subjectRows,
        table1: table1Rows.length > 0 ? table1Rows : subjectRows,
        top_10_students: topStudents,
        comparative_analysis: comparative,
      },
    };
  }
  const serialNumber = `${template.type}-${new Date().getUTCFullYear()}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 12)
    .toUpperCase()}`;
  const payload = {
    template: template.config,
    student,
    staff,
    exam,
    result,
    tokens: marksheetTokens,
    schedule: admitSchedule,
    admit: admitMeta,
    custom: input.payload ?? {},
  } as Prisma.InputJsonValue;
  return prisma.generatedDocument.create({
    data: {
      tenantId,
      templateId: template.id,
      studentId: student?.id,
      staffId: staff?.id,
      examId: exam?.id,
      serialNumber,
      barcodeValue: input.barcodeValue ?? serialNumber,
      payload,
      generatedById,
    },
    include: { template: true, student: true, staff: { include: { user: true } }, exam: true },
  });
}

const BULK_GENERATE_CAP = 150;

export async function generateDocumentsBulk(
  tenantId: string,
  generatedById: string,
  input: {
    templateId: string;
    examId: string;
    studentIds?: string[];
    classSectionId?: string;
  },
) {
  const template = await prisma.documentTemplate.findFirst({
    where: tenantScope(tenantId, { id: input.templateId, isActive: true }),
  });
  if (!template) throw new AppError(404, "Active template not found", "TEMPLATE_NOT_FOUND");
  if (
    template.type !== DocumentTemplateType.ADMIT_CARD &&
    template.type !== DocumentTemplateType.MARKSHEET
  ) {
    throw new AppError(400, "Bulk generate supports admit cards and marksheets only", "BULK_TYPE_UNSUPPORTED");
  }
  const exam = await prisma.exam.findFirst({
    where: tenantScope(tenantId, { id: input.examId }),
  });
  if (!exam) throw new AppError(400, "Exam is invalid", "INVALID_EXAM");

  let studentIds = [...new Set(input.studentIds ?? [])];
  if (!studentIds.length) {
    const assigned = await prisma.examStudent.findMany({
      where: tenantScope(tenantId, {
        examId: input.examId,
        ...(input.classSectionId
          ? { studentEnrollment: { classSectionId: input.classSectionId } }
          : {}),
      }),
      select: { studentEnrollment: { select: { studentId: true } } },
    });
    studentIds = assigned.map((row) => row.studentEnrollment.studentId);
  }
  if (!studentIds.length) {
    throw new AppError(400, "No students found for bulk generate", "BULK_EMPTY");
  }
  if (studentIds.length > BULK_GENERATE_CAP) {
    throw new AppError(
      400,
      `Bulk generate is limited to ${BULK_GENERATE_CAP} students`,
      "BULK_LIMIT_EXCEEDED",
    );
  }

  const documents: Array<{ id: string; studentId: string | null; serialNumber: string }> = [];
  for (const studentId of studentIds) {
    const doc = await generateDocument(tenantId, generatedById, {
      templateId: input.templateId,
      examId: input.examId,
      studentId,
    });
    documents.push({
      id: doc.id,
      studentId: doc.studentId,
      serialNumber: doc.serialNumber,
    });
  }
  return { documents };
}

export async function listGeneratedDocuments(
  tenantId: string,
  query: { type?: DocumentTemplateType; studentId?: string; staffId?: string },
) {
  // Keep list rows slim: full template rows carry multi-MB background data URLs
  // and the payload column snapshots the whole student/result — both are only
  // needed on the single-document print endpoint.
  return prisma.generatedDocument.findMany({
    where: tenantScope(tenantId, {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.type ? { template: { type: query.type } } : {}),
    }),
    select: {
      id: true,
      serialNumber: true,
      barcodeValue: true,
      generatedAt: true,
      template: {
        select: { id: true, type: true, name: true, width: true, height: true, isActive: true },
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          photoUrl: true,
        },
      },
      staff: {
        select: {
          id: true,
          employeeNumber: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      exam: { select: { id: true, name: true } },
      generatedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { generatedAt: "desc" },
  });
}

export async function getGeneratedDocument(tenantId: string, documentId: string) {
  const document = await prisma.generatedDocument.findFirst({
    where: tenantScope(tenantId, { id: documentId }),
    include: {
      template: true,
      student: true,
      staff: { include: { user: true, department: true, designation: true } },
      exam: { include: { examGroup: true } },
      generatedBy: { select: { firstName: true, lastName: true } },
      tenant: { select: { name: true, branding: true } },
    },
  });
  if (!document) {
    throw new AppError(404, "Generated document not found", "DOCUMENT_NOT_FOUND");
  }
  return document;
}
