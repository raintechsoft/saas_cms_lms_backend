import { DocumentTemplateType, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { getExamResults } from "../exams/exams.service.js";

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
  if (template.type === DocumentTemplateType.ADMIT_CARD && student && exam) {
    const assigned = await prisma.examStudent.count({
      where: tenantScope(tenantId, {
        examId: exam.id,
        studentEnrollment: { studentId: student.id },
      }),
    });
    if (!assigned) {
      throw new AppError(400, "Student is not assigned to this exam", "STUDENT_NOT_IN_EXAM");
    }
  }
  if (template.type === DocumentTemplateType.MARKSHEET && student && exam) {
    const report = await getExamResults(tenantId, exam.id);
    result = report.results.find((item) => item.student.id === student.id) ?? null;
    if (!result) {
      throw new AppError(400, "Student is not assigned to this exam", "STUDENT_NOT_IN_EXAM");
    }
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

export async function listGeneratedDocuments(
  tenantId: string,
  query: { type?: DocumentTemplateType; studentId?: string; staffId?: string },
) {
  return prisma.generatedDocument.findMany({
    where: tenantScope(tenantId, {
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.staffId ? { staffId: query.staffId } : {}),
      ...(query.type ? { template: { type: query.type } } : {}),
    }),
    include: {
      template: true,
      student: true,
      staff: { include: { user: true } },
      exam: true,
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
