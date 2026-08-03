import {
  type AdmissionType,
  EnrollmentStatus,
  type Gender,
  type Prisma,
  type StudentStatus,
  TenantType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "node:path";
import { randomInt } from "node:crypto";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { ensureTenantRoles } from "../../lib/tenant-bootstrap.js";
import { tenantScope } from "../../lib/tenant-scope.js";
import { persistAvatarUpload } from "../../lib/uploads.js";

interface StudentInput {
  admissionNumber?: string;
  firstName: string;
  lastName?: string | null;
  gender?: Gender | null;
  dateOfBirth?: Date | null;
  categoryId?: string | null;
  houseId?: string | null;
  religion?: string | null;
  caste?: string | null;
  mobile?: string | null;
  email?: string | null;
  admissionDate: Date;
  photoUrl?: string | null;
  bloodGroup?: string | null;
  height?: number | null;
  weight?: number | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  fatherName?: string | null;
  fatherPhone?: string | null;
  fatherEmail?: string | null;
  fatherOccupation?: string | null;
  motherName?: string | null;
  motherPhone?: string | null;
  motherEmail?: string | null;
  motherOccupation?: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  guardianOccupation?: string | null;
  nationality?: string | null;
  admissionType?: AdmissionType;
  rteEnabled?: boolean;
  rteSchemeName?: string | null;
  rteCertificateNo?: string | null;
  transportOptIn?: boolean;
  transportRoute?: string | null;
  hostelOptIn?: boolean;
  hostelRoom?: string | null;
  additionalNotes?: string | null;
  classSectionId: string;
  rollNumber?: string | null;
}

interface UpdateStudentInput extends Omit<Partial<StudentInput>, "classSectionId" | "rollNumber"> {
  status?: StudentStatus;
  disabledReason?: string | null;
}

const studentInclude = {
  category: true,
  house: true,
  enrollments: {
    include: {
      academicSession: true,
      classSection: {
        include: { academicClass: true, section: true },
      },
    },
    orderBy: { enrolledAt: "desc" as const },
  },
} as const;

export async function getStudentSetup(tenantId: string) {
  const [categories, houses, disableReasons, currentSession, classSections] = await Promise.all([
    prisma.studentCategory.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { name: "asc" },
    }),
    prisma.studentHouse.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { name: "asc" },
    }),
    prisma.disableReason.findMany({
      where: tenantScope(tenantId, {}),
      orderBy: { name: "asc" },
    }),
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { isCurrent: true }),
    }),
    prisma.classSection.findMany({
      where: tenantScope(tenantId, { academicSession: { isCurrent: true } }),
      include: { academicClass: true, section: true },
      orderBy: [
        { academicClass: { sortOrder: "asc" } },
        { section: { name: "asc" } },
      ],
    }),
  ]);
  return { categories, houses, disableReasons, currentSession, classSections };
}

export async function listStudents(
  tenantId: string,
  query: { search?: string; status?: StudentStatus; classSectionId?: string; page: number; limit: number },
) {
  const where = tenantScope(tenantId, {
    status: query.status,
    enrollments: query.classSectionId
      ? { some: { classSectionId: query.classSectionId, status: EnrollmentStatus.ACTIVE } }
      : undefined,
    OR: query.search
      ? [
          { admissionNumber: { contains: query.search } },
          { firstName: { contains: query.search } },
          { lastName: { contains: query.search } },
          { email: { contains: query.search } },
          { mobile: { contains: query.search } },
        ]
      : undefined,
  });
  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.student.count({ where }),
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

async function validateStudentReferences(
  tenantId: string,
  input: { categoryId?: string | null; houseId?: string | null },
) {
  const [category, house] = await Promise.all([
    input.categoryId
      ? prisma.studentCategory.findFirst({
          where: tenantScope(tenantId, { id: input.categoryId }),
        })
      : Promise.resolve(true),
    input.houseId
      ? prisma.studentHouse.findFirst({
          where: tenantScope(tenantId, { id: input.houseId }),
        })
      : Promise.resolve(true),
  ]);
  if (!category || !house) {
    throw new AppError(400, "Category or house is invalid", "INVALID_STUDENT_REFERENCE");
  }
}

function normalizeLoginEmail(value?: string | null) {
  const email = value?.trim().toLowerCase();
  return email && email.includes("@") ? email : null;
}

function generateTempPassword(prefix: "Stu" | "Par") {
  return `${prefix}@${randomInt(100000, 999999)}`;
}

async function resolveTenantRoleId(
  tx: Prisma.TransactionClient,
  tenantId: string,
  code: "STUDENT" | "PARENT",
) {
  let role = await tx.role.findFirst({
    where: { tenantId, code },
    select: { id: true },
  });
  if (!role) {
    await ensureTenantRoles(tenantId, tx);
    role = await tx.role.findFirst({
      where: { tenantId, code },
      select: { id: true },
    });
  }
  if (!role) {
    throw new AppError(500, `${code} role is missing for this institute`, "ROLE_MISSING");
  }
  return role.id;
}

export type PortalCredential = {
  email: string;
  password: string;
  role: "STUDENT" | "PARENT";
  relation?: string | null;
  created: boolean;
};

export async function createStudent(tenantId: string, input: StudentInput) {
  await validateStudentReferences(tenantId, input);
  const classSection = await prisma.classSection.findFirst({
    where: tenantScope(tenantId, { id: input.classSectionId }),
  });
  if (!classSection) {
    throw new AppError(400, "Class section is invalid", "INVALID_CLASS_SECTION");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    let admissionNumber = input.admissionNumber?.trim();
    if (!admissionNumber) {
      const currentSetting = await tx.tenantSetting.findUnique({ where: { tenantId } });
      if (!currentSetting?.autoAdmissionNumber) {
        throw new AppError(
          400,
          "Admission number is required unless auto numbering is enabled",
          "ADMISSION_NUMBER_REQUIRED",
        );
      }
      const setting = await tx.tenantSetting.update({
        where: { tenantId },
        data: { nextAdmissionNumber: { increment: 1 } },
      });
      const sequence = setting.nextAdmissionNumber - 1;
      admissionNumber = `${setting.admissionPrefix ?? ""}${sequence}`;
    }

    const studentEmail =
      normalizeLoginEmail(input.email) ??
      `stu.${admissionNumber.toLowerCase().replace(/[^a-z0-9]+/g, "")}@${tenant.slug}.local`;

    const fatherEmail = normalizeLoginEmail(input.fatherEmail);
    const motherEmail = normalizeLoginEmail(input.motherEmail);
    const guardianEmail = normalizeLoginEmail(input.guardianEmail);
    const parentEmailCandidate = fatherEmail ?? motherEmail ?? guardianEmail;
    const parentEmail =
      parentEmailCandidate && parentEmailCandidate !== studentEmail ? parentEmailCandidate : null;
    const parentRelation = fatherEmail
      ? "Father"
      : motherEmail
        ? "Mother"
        : input.guardianRelation?.trim() || "Guardian";
    const parentFullName = (
      (fatherEmail && input.fatherName) ||
      (motherEmail && input.motherName) ||
      input.guardianName ||
      "Parent Account"
    ).trim();
    const parentFirstName = parentFullName.split(/\s+/)[0] || "Parent";
    const parentLastName = parentFullName.split(/\s+/).slice(1).join(" ") || "Account";

    const credentials: PortalCredential[] = [];
    const studentPassword = generateTempPassword("Stu");
    const studentRoleId = await resolveTenantRoleId(tx, tenantId, "STUDENT");

    const existingStudentUser = await tx.user.findFirst({
      where: tenantScope(tenantId, { email: studentEmail }),
      select: { id: true },
    });
    if (existingStudentUser) {
      throw new AppError(
        409,
        `Student login email already exists: ${studentEmail}`,
        "STUDENT_LOGIN_EXISTS",
      );
    }

    const studentUser = await tx.user.create({
      data: {
        tenantId,
        email: studentEmail,
        passwordHash: await bcrypt.hash(studentPassword, 12),
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || "Student",
        phone: input.mobile?.trim() || null,
        roles: {
          create: [{ roleId: studentRoleId, tenantId }],
        },
      },
      select: { id: true, email: true },
    });
    credentials.push({
      email: studentUser.email,
      password: studentPassword,
      role: "STUDENT",
      created: true,
    });

    let parentUserId: string | null = null;
    if (parentEmail) {
      const parentRoleId = await resolveTenantRoleId(tx, tenantId, "PARENT");
      const existingParent = await tx.user.findFirst({
        where: tenantScope(tenantId, { email: parentEmail }),
        select: {
          id: true,
          email: true,
          roles: { include: { role: { select: { code: true } } } },
        },
      });

      if (existingParent) {
        const isParent = existingParent.roles.some((item) => item.role.code === "PARENT");
        if (!isParent) {
          throw new AppError(
            409,
            `Parent email is already used by a non-parent account: ${parentEmail}`,
            "PARENT_EMAIL_CONFLICT",
          );
        }
        parentUserId = existingParent.id;
        credentials.push({
          email: existingParent.email,
          password: "(existing account — use current password)",
          role: "PARENT",
          relation: parentRelation,
          created: false,
        });
      } else {
        const parentPassword = generateTempPassword("Par");
        const parentUser = await tx.user.create({
          data: {
            tenantId,
            email: parentEmail,
            passwordHash: await bcrypt.hash(parentPassword, 12),
            firstName: parentFirstName,
            lastName: parentLastName,
            phone:
              (fatherEmail && input.fatherPhone) ||
              (motherEmail && input.motherPhone) ||
              input.guardianPhone ||
              null,
            roles: {
              create: [{ roleId: parentRoleId, tenantId }],
            },
          },
          select: { id: true, email: true },
        });
        parentUserId = parentUser.id;
        credentials.push({
          email: parentUser.email,
          password: parentPassword,
          role: "PARENT",
          relation: parentRelation,
          created: true,
        });
      }
    }

    const student = await tx.student.create({
      data: {
        tenantId,
        userId: studentUser.id,
        admissionNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
        categoryId: input.categoryId,
        houseId: input.houseId,
        religion: input.religion,
        caste: input.caste,
        mobile: input.mobile,
        email: normalizeLoginEmail(input.email) ?? studentEmail,
        admissionDate: input.admissionDate,
        photoUrl: input.photoUrl,
        bloodGroup: input.bloodGroup,
        height: input.height,
        weight: input.weight,
        currentAddress: input.currentAddress,
        permanentAddress: input.permanentAddress,
        fatherName: input.fatherName,
        fatherPhone: input.fatherPhone,
        fatherEmail: input.fatherEmail,
        fatherOccupation: input.fatherOccupation,
        motherName: input.motherName,
        motherPhone: input.motherPhone,
        motherEmail: input.motherEmail,
        motherOccupation: input.motherOccupation,
        guardianName: input.guardianName,
        guardianRelation: input.guardianRelation,
        guardianPhone: input.guardianPhone,
        guardianEmail: input.guardianEmail,
        guardianOccupation: input.guardianOccupation,
        nationality: input.nationality,
        admissionType: input.admissionType,
        rteEnabled: input.rteEnabled,
        rteSchemeName: input.rteSchemeName,
        rteCertificateNo: input.rteCertificateNo,
        transportOptIn: input.transportOptIn,
        transportRoute: input.transportRoute,
        hostelOptIn: input.hostelOptIn,
        hostelRoom: input.hostelRoom,
        additionalNotes: input.additionalNotes,
        enrollments: {
          create: {
            tenantId,
            academicSessionId: classSection.academicSessionId,
            classSectionId: classSection.id,
            rollNumber: input.rollNumber,
          },
        },
        ...(parentUserId
          ? {
              guardians: {
                create: {
                  tenantId,
                  userId: parentUserId,
                  relation: parentRelation,
                  isPrimary: true,
                },
              },
            }
          : {}),
      },
      include: studentInclude,
    });

    return { ...student, credentials };
  });
}

export async function updateStudent(tenantId: string, id: string, input: UpdateStudentInput) {
  const student = await prisma.student.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");
  await validateStudentReferences(tenantId, input);
  if (input.status === "DISABLED" && !input.disabledReason?.trim()) {
    throw new AppError(400, "Disable reason is required", "DISABLE_REASON_REQUIRED");
  }
  return prisma.student.update({
    where: { id },
    data: {
      ...input,
      email: input.email === undefined ? undefined : input.email?.trim().toLowerCase() || null,
      disabledReason: input.status === "ACTIVE" ? null : input.disabledReason,
    },
    include: studentInclude,
  });
}

export async function addEnrollment(
  tenantId: string,
  studentId: string,
  input: { classSectionId: string; rollNumber?: string | null },
) {
  const [student, classSection, tenant] = await Promise.all([
    prisma.student.findFirst({ where: tenantScope(tenantId, { id: studentId }) }),
    prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: input.classSectionId }),
    }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);
  if (!student || !classSection) {
    throw new AppError(404, "Student or class section not found", "ENROLLMENT_REFERENCE");
  }
  if (tenant?.type !== TenantType.COACHING_CENTER) {
    const existing = await prisma.studentEnrollment.findFirst({
      where: tenantScope(tenantId, {
        studentId,
        academicSessionId: classSection.academicSessionId,
        status: EnrollmentStatus.ACTIVE,
      }),
    });
    if (existing) {
      throw new AppError(
        409,
        "Only coaching centers can enroll a student in multiple classes per session",
        "MULTI_CLASS_NOT_ALLOWED",
      );
    }
  }
  return prisma.studentEnrollment.create({
    data: {
      tenantId,
      studentId,
      academicSessionId: classSection.academicSessionId,
      classSectionId: classSection.id,
      rollNumber: input.rollNumber,
    },
    include: {
      academicSession: true,
      classSection: { include: { academicClass: true, section: true } },
    },
  });
}

export async function deleteStudentMaster(
  tenantId: string,
  resource: "categories" | "houses" | "disable-reasons",
  id: string,
) {
  if (resource === "categories") {
    const result = await prisma.studentCategory.deleteMany({ where: tenantScope(tenantId, { id }) });
    if (!result.count) throw new AppError(404, "Record not found", "RECORD_NOT_FOUND");
    return;
  }
  if (resource === "houses") {
    const result = await prisma.studentHouse.deleteMany({ where: tenantScope(tenantId, { id }) });
    if (!result.count) throw new AppError(404, "Record not found", "RECORD_NOT_FOUND");
    return;
  }
  const result = await prisma.disableReason.deleteMany({ where: tenantScope(tenantId, { id }) });
  if (!result.count) throw new AppError(404, "Record not found", "RECORD_NOT_FOUND");
}

export async function getStudentDetail(tenantId: string, id: string) {
  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      ...studentInclude,
      documents: {
        where: { deletedAt: null },
        include: { folder: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");

  const siblings = student.siblingGroupId
    ? await prisma.student.findMany({
        where: tenantScope(tenantId, {
          siblingGroupId: student.siblingGroupId,
          id: { not: student.id },
        }),
        select: {
          id: true,
          admissionNumber: true,
          firstName: true,
          lastName: true,
          status: true,
        },
        orderBy: { firstName: "asc" },
      })
    : [];

  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  let fees: unknown = null;
  try {
    const { listStudentFees } = await import("../fees/fees.service.js");
    fees = await listStudentFees(tenantId, id, currentSession?.id);
  } catch {
    fees = null;
  }

  return { ...student, siblings, fees };
}

export async function deleteStudents(tenantId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const result = await prisma.student.deleteMany({
    where: tenantScope(tenantId, { id: { in: unique } }),
  });
  return { deleted: result.count };
}

function admissionKeyFromFilename(originalName: string) {
  const base = path.basename(originalName).trim();
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
  let stem = base;
  let stripped = false;

  // Strip one or more image extensions (handles SCL-1.jpg.jpg from Windows rename).
  for (;;) {
    const ext = path.extname(stem).toLowerCase();
    if (!allowed.has(ext)) break;
    stem = stem.slice(0, stem.length - ext.length).trim();
    stripped = true;
  }

  if (!stripped || !stem) return null;
  return stem;
}

export async function bulkUploadStudentPhotos(
  tenantId: string,
  files: Express.Multer.File[],
  options?: { classSectionId?: string | null },
) {
  if (!files.length) {
    throw new AppError(400, "Select at least one image file", "FILES_REQUIRED");
  }
  if (files.length > 20) {
    throw new AppError(400, "You can upload at most 20 images in one batch", "TOO_MANY_FILES");
  }

  if (options?.classSectionId) {
    const section = await prisma.classSection.findFirst({
      where: tenantScope(tenantId, { id: options.classSectionId }),
      select: { id: true },
    });
    if (!section) {
      throw new AppError(400, "Invalid class section", "INVALID_CLASS_SECTION");
    }
  }

  const results: Array<{
    fileName: string;
    admissionNumber: string | null;
    status: "UPDATED" | "NOT_FOUND" | "INVALID_NAME" | "TOO_LARGE" | "FAILED";
    studentId?: string;
    studentName?: string;
    photoUrl?: string;
    message?: string;
  }> = [];

  for (const file of files) {
    const fileName = file.originalname;
    if (file.size > 500 * 1024) {
      results.push({
        fileName,
        admissionNumber: null,
        status: "TOO_LARGE",
        message: "Image exceeds 500KB limit",
      });
      continue;
    }

    const admissionNumber = admissionKeyFromFilename(fileName);
    if (!admissionNumber) {
      results.push({
        fileName,
        admissionNumber: null,
        status: "INVALID_NAME",
        message: "Use JPG/PNG named as admission number (e.g. 133.jpg)",
      });
      continue;
    }

    const student = await prisma.student.findFirst({
      where: tenantScope(tenantId, {
        admissionNumber: { equals: admissionNumber, mode: "insensitive" as const },
        ...(options?.classSectionId
          ? {
              enrollments: {
                some: {
                  classSectionId: options.classSectionId,
                  status: EnrollmentStatus.ACTIVE,
                },
              },
            }
          : {}),
      }),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        userId: true,
      },
    });

    if (!student) {
      results.push({
        fileName,
        admissionNumber,
        status: "NOT_FOUND",
        message: options?.classSectionId
          ? "No matching student in selected class section"
          : "No student found with this admission number",
      });
      continue;
    }

    try {
      const photoUrl = await persistAvatarUpload(file);
      await prisma.student.update({
        where: { id: student.id },
        data: { photoUrl },
      });
      if (student.userId) {
        await prisma.user.update({
          where: { id: student.userId },
          data: { avatarUrl: photoUrl },
        });
      }
      results.push({
        fileName,
        admissionNumber: student.admissionNumber,
        status: "UPDATED",
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName ?? ""}`.trim(),
        photoUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      results.push({
        fileName,
        admissionNumber: student.admissionNumber,
        status: "FAILED",
        studentId: student.id,
        message,
      });
    }
  }

  return {
    total: files.length,
    updated: results.filter((item) => item.status === "UPDATED").length,
    failed: results.filter((item) => item.status !== "UPDATED").length,
    results,
  };
}

export async function linkSiblings(tenantId: string, studentIds: string[]) {
  const unique = [...new Set(studentIds)];
  if (unique.length < 2) {
    throw new AppError(400, "Select at least two students to link as siblings", "SIBLING_MIN");
  }
  const students = await prisma.student.findMany({
    where: tenantScope(tenantId, { id: { in: unique } }),
    select: { id: true, siblingGroupId: true },
  });
  if (students.length !== unique.length) {
    throw new AppError(404, "One or more students were not found", "STUDENT_NOT_FOUND");
  }
  const existingGroup = students.find((item) => item.siblingGroupId)?.siblingGroupId;
  const siblingGroupId = existingGroup ?? `sib_${Date.now().toString(36)}`;
  await prisma.student.updateMany({
    where: tenantScope(tenantId, { id: { in: unique } }),
    data: { siblingGroupId },
  });
  return prisma.student.findMany({
    where: tenantScope(tenantId, { siblingGroupId }),
    select: { id: true, admissionNumber: true, firstName: true, lastName: true, siblingGroupId: true },
  });
}

export async function detectSiblings(tenantId: string, studentId: string) {
  const student = await prisma.student.findFirst({ where: tenantScope(tenantId, { id: studentId }) });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");
  const phones = [student.fatherPhone, student.motherPhone, student.guardianPhone, student.mobile]
    .map((value) => value?.trim())
    .filter(Boolean) as string[];
  if (!phones.length) return [];
  return prisma.student.findMany({
    where: tenantScope(tenantId, {
      id: { not: studentId },
      OR: [
        { fatherPhone: { in: phones } },
        { motherPhone: { in: phones } },
        { guardianPhone: { in: phones } },
        { mobile: { in: phones } },
      ],
    }),
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      fatherPhone: true,
      motherPhone: true,
      guardianPhone: true,
      mobile: true,
      siblingGroupId: true,
    },
    take: 25,
  });
}

export async function importStudentsCsv(tenantId: string, csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new AppError(400, "CSV must include a header row and at least one data row", "CSV_EMPTY");
  }
  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const required = ["firstname", "admissiondate", "classsectionid"];
  for (const key of required) {
    if (!headers.includes(key)) {
      throw new AppError(400, `CSV is missing required column: ${key}`, "CSV_HEADER");
    }
  }
  const created: string[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i]?.trim() ?? "";
    });
    try {
      const student = await createStudent(tenantId, {
        admissionNumber: row.admissionnumber || undefined,
        firstName: row.firstname,
        lastName: row.lastname || null,
        mobile: row.mobile || null,
        email: row.email || null,
        gender: parseGender(row.gender),
        dateOfBirth: row.dateofbirth ? new Date(row.dateofbirth) : null,
        admissionDate: new Date(row.admissiondate),
        classSectionId: row.classsectionid,
        rollNumber: row.rollnumber || null,
        fatherName: row.fathername || null,
        fatherPhone: row.fatherphone || null,
        motherName: row.mothername || null,
        motherPhone: row.motherphone || null,
        guardianName: row.guardianname || null,
        guardianPhone: row.guardianphone || null,
        photoUrl: row.photourl || null,
        categoryId: row.categoryid || null,
        houseId: row.houseid || null,
      });
      created.push(student.id);
    } catch (cause) {
      errors.push({
        row: index + 1,
        message: cause instanceof AppError ? cause.message : "Failed to import row",
      });
    }
  }
  return { created: created.length, errors };
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function parseGender(value?: string) {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "MALE" || normalized === "FEMALE" || normalized === "OTHER") return normalized;
  return null;
}

export function createStudentMaster(
  tenantId: string,
  resource: "categories" | "houses" | "disable-reasons",
  name: string,
) {
  if (resource === "categories") return prisma.studentCategory.create({ data: { tenantId, name } });
  if (resource === "houses") return prisma.studentHouse.create({ data: { tenantId, name } });
  return prisma.disableReason.create({ data: { tenantId, name } });
}
