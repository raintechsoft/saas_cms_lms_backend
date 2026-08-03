/**
 * Seeds rich sample data for testing Students Documents + Student Reports.
 * Run: npx tsx prisma/seed-docs-reports-samples.ts
 */
import {
  EnrollmentStatus,
  Gender,
  OnlineAdmissionStatus,
  PrismaClient,
  StudentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function ensureFolder(tenantId: string, name: string, parentId: string | null = null) {
  const existing = await prisma.studentDocumentFolder.findFirst({
    where: { tenantId, name, parentId },
  });
  if (existing) return existing;
  return prisma.studentDocumentFolder.create({
    data: { tenantId, name, parentId },
  });
}

async function ensureDocument(input: {
  tenantId: string;
  studentId: string;
  folderId: string;
  name: string;
  fileUrl: string;
  uploadedById: string;
  mimeType?: string;
}) {
  const existing = await prisma.studentDocument.findFirst({
    where: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      folderId: input.folderId,
      name: input.name,
      deletedAt: null,
    },
  });
  if (existing) return existing;
  return prisma.studentDocument.create({
    data: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      folderId: input.folderId,
      name: input.name,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType ?? "application/pdf",
      sizeBytes: 128_000,
      uploadedById: input.uploadedById,
    },
  });
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "demo-school" } });
  if (!tenant) throw new Error("demo-school tenant not found — run main seed first");

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "admin@demo-school.local" },
  });
  if (!admin) throw new Error("demo admin not found");

  const session = await prisma.academicSession.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
  });
  if (!session) throw new Error("current session not found");

  const class10a = await prisma.classSection.findFirst({
    where: {
      tenantId: tenant.id,
      academicClass: { name: "Class 10" },
      section: { name: "A" },
    },
  });
  const class10b = await prisma.classSection.findFirst({
    where: {
      tenantId: tenant.id,
      academicClass: { name: "Class 10" },
      section: { name: "B" },
    },
  });
  if (!class10a || !class10b) throw new Error("Class 10 A/B not found");

  // --- Folders ---
  const admissionFolder = await ensureFolder(tenant.id, "Admission Documents");
  const marksheetFolder = await ensureFolder(tenant.id, "Previous year mark sheet");
  const idProofFolder = await ensureFolder(tenant.id, "ID Proof");
  const transferFolder = await ensureFolder(tenant.id, "Transfer Certificate");

  const students = await prisma.student.findMany({
    where: { tenantId: tenant.id },
    orderBy: { admissionNumber: "asc" },
  });
  const byAdm = Object.fromEntries(students.map((s) => [s.admissionNumber, s]));

  const aarav = byAdm["SCL-1"];
  const sujith = byAdm["15"];
  const student10 = byAdm["22"];
  if (!aarav) throw new Error("SCL-1 (Aarav) missing");

  // --- Sample documents ---
  await ensureDocument({
    tenantId: tenant.id,
    studentId: aarav.id,
    folderId: admissionFolder.id,
    name: "Birth certificate",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    uploadedById: admin.id,
  });
  await ensureDocument({
    tenantId: tenant.id,
    studentId: aarav.id,
    folderId: marksheetFolder.id,
    name: "Class 9 Final Marksheet",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    uploadedById: admin.id,
  });
  await ensureDocument({
    tenantId: tenant.id,
    studentId: aarav.id,
    folderId: idProofFolder.id,
    name: "Aadhaar Card Copy",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    uploadedById: admin.id,
  });

  if (sujith) {
    await ensureDocument({
      tenantId: tenant.id,
      studentId: sujith.id,
      folderId: marksheetFolder.id,
      name: "Class 9 Final Marksheet",
      fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      uploadedById: admin.id,
    });
    await ensureDocument({
      tenantId: tenant.id,
      studentId: sujith.id,
      folderId: admissionFolder.id,
      name: "Transfer Certificate",
      fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      uploadedById: admin.id,
    });
  }

  if (student10) {
    await ensureDocument({
      tenantId: tenant.id,
      studentId: student10.id,
      folderId: transferFolder.id,
      name: "TC from previous school",
      fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      uploadedById: admin.id,
    });
  }

  // --- Enrich profiles for reports ---
  const siblingGroupId = "demo-sibling-group-kumar";

  // Sibling pair: Aarav + new sibling if needed
  let sibling =
    (await prisma.student.findFirst({
      where: { tenantId: tenant.id, admissionNumber: "SCL-2" },
    })) ?? null;

  if (!sibling) {
    sibling = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        admissionNumber: "SCL-2",
        firstName: "Ananya",
        lastName: "Kumar",
        gender: Gender.FEMALE,
        dateOfBirth: new Date("2014-03-18T00:00:00.000Z"),
        mobile: "9876500012",
        email: "ananya.kumar@demo-school.local",
        admissionDate: new Date("2026-04-02T00:00:00.000Z"),
        fatherName: "Raj Kumar",
        fatherPhone: "9111111111",
        motherName: "Priya Kumar",
        motherPhone: "9111111112",
        guardianName: "Raj Kumar",
        guardianRelation: "Father",
        guardianPhone: "9111111111",
        status: StudentStatus.ACTIVE,
        siblingGroupId,
        categoryId: aarav.categoryId,
        houseId: aarav.houseId,
      },
    });
    await prisma.studentEnrollment.create({
      data: {
        tenantId: tenant.id,
        studentId: sibling.id,
        academicSessionId: session.id,
        classSectionId: class10a.id,
        rollNumber: "2",
        status: EnrollmentStatus.ACTIVE,
      },
    });
  } else {
    await prisma.student.update({
      where: { id: sibling.id },
      data: { siblingGroupId, gender: Gender.FEMALE },
    });
  }

  await prisma.student.update({
    where: { id: aarav.id },
    data: {
      siblingGroupId,
      gender: Gender.MALE,
      dateOfBirth: new Date("2012-08-15T00:00:00.000Z"),
      fatherName: "Raj Kumar",
      fatherPhone: "9111111111",
      motherName: "Priya Kumar",
      motherPhone: "9111111112",
      guardianName: "Raj Kumar",
      guardianRelation: "Father",
      guardianPhone: "9111111111",
      guardianEmail: "parent@demo-school.local",
    },
  });

  // Female student for gender report
  if (sujith) {
    await prisma.student.update({
      where: { id: sujith.id },
      data: {
        gender: Gender.FEMALE,
        dateOfBirth: new Date("2011-11-05T00:00:00.000Z"),
        motherName: "Latha Suja",
        motherPhone: "8129504194",
        guardianName: "Latha Suja",
        guardianRelation: "Mother",
        guardianPhone: "8129504194",
      },
    });
  }

  // Disabled sample
  let disabled = await prisma.student.findFirst({
    where: { tenantId: tenant.id, admissionNumber: "DIS-1" },
  });
  if (!disabled) {
    disabled = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        admissionNumber: "DIS-1",
        firstName: "Rohit",
        lastName: "Sharma",
        gender: Gender.MALE,
        dateOfBirth: new Date("2010-01-20T00:00:00.000Z"),
        admissionDate: new Date("2024-06-01T00:00:00.000Z"),
        status: StudentStatus.DISABLED,
        disabledReason: "Long absence / left without TC",
        fatherName: "Vikram Sharma",
        fatherPhone: "9000000001",
      },
    });
    await prisma.studentEnrollment.create({
      data: {
        tenantId: tenant.id,
        studentId: disabled.id,
        academicSessionId: session.id,
        classSectionId: class10b.id,
        rollNumber: "99",
        status: EnrollmentStatus.INACTIVE,
      },
    });
  }

  // Alumni sample
  let alumni = await prisma.student.findFirst({
    where: { tenantId: tenant.id, admissionNumber: "ALU-1" },
  });
  if (!alumni) {
    alumni = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        admissionNumber: "ALU-1",
        firstName: "Meera",
        lastName: "Nair",
        gender: Gender.FEMALE,
        dateOfBirth: new Date("2007-07-07T00:00:00.000Z"),
        admissionDate: new Date("2020-04-01T00:00:00.000Z"),
        status: StudentStatus.ALUMNI,
        fatherName: "Suresh Nair",
        motherName: "Kavitha Nair",
      },
    });
  }

  // Old admission (before current session)
  let oldAdmission = await prisma.student.findFirst({
    where: { tenantId: tenant.id, admissionNumber: "OLD-1" },
  });
  if (!oldAdmission) {
    oldAdmission = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        admissionNumber: "OLD-1",
        firstName: "Kabir",
        lastName: "Das",
        gender: Gender.MALE,
        dateOfBirth: new Date("2011-02-14T00:00:00.000Z"),
        admissionDate: new Date("2023-04-10T00:00:00.000Z"),
        status: StudentStatus.ACTIVE,
        fatherName: "Amit Das",
        fatherPhone: "9000000011",
      },
    });
    await prisma.studentEnrollment.create({
      data: {
        tenantId: tenant.id,
        studentId: oldAdmission.id,
        academicSessionId: session.id,
        classSectionId: class10b.id,
        rollNumber: "12",
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  // Online admissions
  const pendingOnline = await prisma.onlineAdmissionApplication.findFirst({
    where: { tenantId: tenant.id, firstName: "Ishaan", lastName: "Patel" },
  });
  if (!pendingOnline) {
    await prisma.onlineAdmissionApplication.create({
      data: {
        tenantId: tenant.id,
        academicSessionId: session.id,
        classSectionId: class10a.id,
        status: OnlineAdmissionStatus.PENDING,
        firstName: "Ishaan",
        lastName: "Patel",
        gender: Gender.MALE,
        dateOfBirth: new Date("2013-05-12T00:00:00.000Z"),
        mobile: "9888777666",
        email: "ishaan.parent@example.com",
        fatherName: "Nilesh Patel",
        motherName: "Sneha Patel",
        guardianPhone: "9888777666",
        currentAddress: "12 MG Road, Demo City",
      },
    });
  }

  const acceptedOnline = await prisma.onlineAdmissionApplication.findFirst({
    where: { tenantId: tenant.id, firstName: "Diya", lastName: "Menon" },
  });
  if (!acceptedOnline) {
    await prisma.onlineAdmissionApplication.create({
      data: {
        tenantId: tenant.id,
        academicSessionId: session.id,
        classSectionId: class10b.id,
        status: OnlineAdmissionStatus.ACCEPTED,
        firstName: "Diya",
        lastName: "Menon",
        gender: Gender.FEMALE,
        dateOfBirth: new Date("2013-09-01T00:00:00.000Z"),
        mobile: "9777666555",
        email: "diya.parent@example.com",
        fatherName: "Arun Menon",
        motherName: "Lakshmi Menon",
        guardianPhone: "9777666555",
        reviewedById: admin.id,
        reviewNote: "Accepted for Class 10 B",
        studentId: sibling.id,
      },
    });
  }

  // Mark class teacher on 10-A for student-teacher report
  const teacher = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "teacher@demo-school.local" },
  });
  if (teacher) {
    await prisma.classSection.update({
      where: { id: class10a.id },
      data: { classTeacherId: teacher.id },
    });
  }

  // Ensure Aarav has a document in marksheet for class filter testing
  await ensureDocument({
    tenantId: tenant.id,
    studentId: sibling.id,
    folderId: marksheetFolder.id,
    name: "Class 9 Final Marksheet",
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    uploadedById: admin.id,
  });

  console.log("\n✅ Sample data ready for demo-school\n");
  console.log("Folders:");
  console.log("  - Admission Documents");
  console.log("  - Previous year mark sheet");
  console.log("  - ID Proof");
  console.log("  - Transfer Certificate");
  console.log("\nExtra students:");
  console.log("  - SCL-2 Ananya Kumar (ACTIVE, sibling of Aarav, FEMALE)");
  console.log("  - DIS-1 Rohit Sharma (DISABLED)");
  console.log("  - ALU-1 Meera Nair (ALUMNI)");
  console.log("  - OLD-1 Kabir Das (old admission date 2023)");
  console.log("\nOnline admissions: Ishaan Patel (PENDING), Diya Menon (ACCEPTED)");
  console.log("\nLogin: admin@demo-school.local / 11111111 (workspace demo-school)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
