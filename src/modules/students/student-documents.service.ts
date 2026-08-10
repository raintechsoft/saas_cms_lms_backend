import { EnrollmentStatus, StudentStatus } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { persistDocumentUpload } from "../../lib/uploads.js";

function studentName(firstName: string, lastName?: string | null) {
  return `${firstName} ${lastName ?? ""}`.trim();
}

export async function listStudentDocumentFolders(tenantId: string) {
  return prisma.studentDocumentFolder.findMany({
    where: tenantScope(tenantId, { deletedAt: null, isActive: true }),
    include: {
      _count: {
        select: {
          documents: { where: { deletedAt: null } },
          children: { where: { deletedAt: null } },
        },
      },
      parent: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listStudentDocumentsBrowser(
  tenantId: string,
  query: {
    folderId?: string;
    classSectionId?: string;
    search?: string;
    studentId?: string;
  },
) {
  if (!query.folderId && !query.studentId) {
    throw new AppError(400, "folderId or studentId is required", "FOLDER_REQUIRED");
  }

  const documents = await prisma.studentDocument.findMany({
    where: tenantScope(tenantId, {
      deletedAt: null,
      ...(query.folderId ? { folderId: query.folderId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.classSectionId
        ? {
            student: {
              enrollments: {
                some: {
                  classSectionId: query.classSectionId,
                  status: EnrollmentStatus.ACTIVE,
                },
              },
            },
          }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: "insensitive" as const } },
              {
                student: {
                  OR: [
                    { firstName: { contains: query.search.trim(), mode: "insensitive" as const } },
                    { lastName: { contains: query.search.trim(), mode: "insensitive" as const } },
                    {
                      admissionNumber: {
                        contains: query.search.trim(),
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    }),
    include: {
      folder: { select: { id: true, name: true } },
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      student: {
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          status: true,
          enrollments: {
            where: { status: EnrollmentStatus.ACTIVE },
            include: {
              classSection: {
                include: {
                  academicClass: { select: { name: true } },
                  section: { select: { name: true } },
                },
              },
            },
            take: 1,
            orderBy: { enrolledAt: "desc" },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
  });

  return {
    items: documents.map((doc) => {
      const enrollment = doc.student.enrollments[0];
      return {
        id: doc.id,
        name: doc.name,
        fileUrl: doc.fileUrl,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        createdAt: doc.createdAt.toISOString(),
        folder: doc.folder,
        uploadedBy: {
          id: doc.uploadedBy.id,
          name: studentName(doc.uploadedBy.firstName, doc.uploadedBy.lastName),
        },
        student: {
          id: doc.student.id,
          admissionNumber: doc.student.admissionNumber,
          name: studentName(doc.student.firstName, doc.student.lastName),
          status: doc.student.status,
          classLabel: enrollment
            ? `${enrollment.classSection.academicClass.name} - ${enrollment.classSection.section.name}`
            : null,
        },
      };
    }),
  };
}

export async function uploadStudentDocumentFile(
  tenantId: string,
  uploadedById: string,
  input: {
    studentId: string;
    folderId: string;
    name?: string;
    file: Express.Multer.File;
  },
) {
  const [student, folder] = await Promise.all([
    prisma.student.findFirst({
      where: tenantScope(tenantId, {
        id: input.studentId,
        status: { not: StudentStatus.DISABLED },
      }),
      select: { id: true },
    }),
    prisma.studentDocumentFolder.findFirst({
      where: tenantScope(tenantId, { id: input.folderId }),
      select: { id: true, name: true },
    }),
  ]);
  if (!student || !folder) {
    throw new AppError(400, "Student or document folder is invalid", "INVALID_DOCUMENT_REFERENCE");
  }

  const fileUrl = await persistDocumentUpload(input.file);
  const name =
    input.name?.trim() ||
    input.file.originalname.replace(/\.[^.]+$/, "").trim() ||
    "Document";

  return prisma.studentDocument.create({
    data: {
      tenantId,
      studentId: input.studentId,
      folderId: input.folderId,
      name,
      fileUrl,
      mimeType: input.file.mimetype || null,
      sizeBytes: input.file.size || null,
      uploadedById,
    },
    include: {
      folder: { select: { id: true, name: true } },
      student: {
        select: { id: true, admissionNumber: true, firstName: true, lastName: true },
      },
    },
  });
}

export async function deleteStudentDocumentWithReason(
  tenantId: string,
  deletedById: string,
  id: string,
  reason: string,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new AppError(400, "Delete reason is required (min 3 characters)", "REASON_REQUIRED");
  }

  const existing = await prisma.studentDocument.findFirst({
    where: tenantScope(tenantId, { id, deletedAt: null }),
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, "Student document not found", "DOCUMENT_NOT_FOUND");
  }

  await prisma.studentDocument.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deleteReason: trimmed.slice(0, 500),
      deletedById,
    },
  });

  return { deleted: true };
}
