import {
  type AdmissionType,
  EnrollmentStatus,
  type Gender,
  type StudentStatus,
  TenantType,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

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

export async function createStudent(tenantId: string, input: StudentInput) {
  await validateStudentReferences(tenantId, input);
  const classSection = await prisma.classSection.findFirst({
    where: tenantScope(tenantId, { id: input.classSectionId }),
  });
  if (!classSection) {
    throw new AppError(400, "Class section is invalid", "INVALID_CLASS_SECTION");
  }

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

    return tx.student.create({
      data: {
        tenantId,
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
        email: input.email?.trim().toLowerCase() || null,
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
      },
      include: studentInclude,
    });
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
