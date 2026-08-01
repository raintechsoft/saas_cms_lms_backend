/**
 * Seeds sample Student Management data for the demo-school tenant.
 * Safe to re-run (upserts by admission number).
 *
 * Usage: npx tsx prisma/seed-students-demo.ts
 */
import "dotenv/config";
import { PrismaClient, type Gender, type StudentStatus } from "@prisma/client";

const prisma = new PrismaClient();

type SeedStudent = {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  status: StudentStatus;
  email: string;
  mobile: string;
  dateOfBirth: string;
  admissionDate: string;
  bloodGroup: string;
  religion: string;
  nationality: string;
  rollNumber: string;
  className: string;
  sectionName: string;
  categoryName: string;
  houseName: string;
  fatherName: string;
  fatherPhone: string;
  fatherEmail: string;
  fatherOccupation: string;
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  motherOccupation: string;
  currentAddress: string;
  permanentAddress: string;
  admissionType?: "REGULAR" | "TRANSFER";
  rteEnabled?: boolean;
  transportOptIn?: boolean;
  transportRoute?: string;
  disabledReason?: string;
};

const STUDENTS: SeedStudent[] = [
  {
    admissionNumber: "2024-NX-012",
    firstName: "Marcus",
    lastName: "Holloway",
    gender: "MALE",
    status: "ACTIVE",
    email: "m.holloway@nexus.edu",
    mobile: "+91 98765 01012",
    dateOfBirth: "2008-05-12",
    admissionDate: "2023-08-15",
    bloodGroup: "O+",
    religion: "Christianity",
    nationality: "Indian",
    rollNumber: "12",
    className: "Class 12",
    sectionName: "A",
    categoryName: "General",
    houseName: "Blue House",
    fatherName: "David Holloway",
    fatherPhone: "+91 98765 11012",
    fatherEmail: "david.holloway@example.com",
    fatherOccupation: "Engineer",
    motherName: "Lisa Holloway",
    motherPhone: "+91 98765 21012",
    motherEmail: "lisa.holloway@example.com",
    motherOccupation: "Teacher",
    currentAddress: "14 Lakeview Road, Bengaluru",
    permanentAddress: "14 Lakeview Road, Bengaluru",
    transportOptIn: true,
    transportRoute: "Route #7",
  },
  {
    admissionNumber: "2024-NX-018",
    firstName: "Elena",
    lastName: "Rodriguez",
    gender: "FEMALE",
    status: "ACTIVE",
    email: "e.rodriguez@nexus.edu",
    mobile: "+91 98765 01018",
    dateOfBirth: "2009-02-20",
    admissionDate: "2023-08-15",
    bloodGroup: "A+",
    religion: "Christianity",
    nationality: "Indian",
    rollNumber: "18",
    className: "Class 11",
    sectionName: "A",
    categoryName: "General",
    houseName: "White House",
    fatherName: "Carlos Rodriguez",
    fatherPhone: "+91 98765 11018",
    fatherEmail: "carlos.r@example.com",
    fatherOccupation: "Architect",
    motherName: "Maria Rodriguez",
    motherPhone: "+91 98765 21018",
    motherEmail: "maria.r@example.com",
    motherOccupation: "Doctor",
    currentAddress: "88 Palm Grove, Hyderabad",
    permanentAddress: "88 Palm Grove, Hyderabad",
  },
  {
    admissionNumber: "2024-NX-024",
    firstName: "Julian",
    lastName: "Chen",
    gender: "MALE",
    status: "DISABLED",
    email: "j.chen@nexus.edu",
    mobile: "+91 98765 01024",
    dateOfBirth: "2010-11-03",
    admissionDate: "2024-04-01",
    bloodGroup: "B+",
    religion: "Buddhism",
    nationality: "Indian",
    rollNumber: "24",
    className: "Class 10",
    sectionName: "A",
    categoryName: "General",
    houseName: "Blue House",
    fatherName: "Wei Chen",
    fatherPhone: "+91 98765 11024",
    fatherEmail: "wei.chen@example.com",
    fatherOccupation: "Business Owner",
    motherName: "Mei Chen",
    motherPhone: "+91 98765 21024",
    motherEmail: "mei.chen@example.com",
    motherOccupation: "Accountant",
    currentAddress: "5 Orchid Lane, Pune",
    permanentAddress: "5 Orchid Lane, Pune",
    disabledReason: "Long leave / medical",
  },
  {
    admissionNumber: "2024-NX-031",
    firstName: "Sarah",
    lastName: "Jenkins",
    gender: "FEMALE",
    status: "ACTIVE",
    email: "s.jenkins@nexus.edu",
    mobile: "+91 98765 01031",
    dateOfBirth: "2008-09-14",
    admissionDate: "2022-06-10",
    bloodGroup: "AB+",
    religion: "Christianity",
    nationality: "Indian",
    rollNumber: "31",
    className: "Class 12",
    sectionName: "B",
    categoryName: "Reserved",
    houseName: "White House",
    fatherName: "Robert Jenkins",
    fatherPhone: "+91 98765 11031",
    fatherEmail: "robert.j@example.com",
    fatherOccupation: "Lawyer",
    motherName: "Helen Jenkins",
    motherPhone: "+91 98765 21031",
    motherEmail: "helen.j@example.com",
    motherOccupation: "Designer",
    currentAddress: "210 Riverfront, Chennai",
    permanentAddress: "210 Riverfront, Chennai",
    rteEnabled: true,
  },
  {
    admissionNumber: "2024-NX-042",
    firstName: "Aarav",
    lastName: "Sharma",
    gender: "MALE",
    status: "ACTIVE",
    email: "aarav.sharma@nexus.edu",
    mobile: "+91 98765 01042",
    dateOfBirth: "2011-06-12",
    admissionDate: "2024-04-01",
    bloodGroup: "O+",
    religion: "Hinduism",
    nationality: "Indian",
    rollNumber: "42",
    className: "Class 9",
    sectionName: "A",
    categoryName: "General",
    houseName: "Blue House",
    fatherName: "Raj Sharma",
    fatherPhone: "+91 98765 11042",
    fatherEmail: "raj.sharma@example.com",
    fatherOccupation: "Banker",
    motherName: "Priya Sharma",
    motherPhone: "+91 98765 21042",
    motherEmail: "priya.sharma@example.com",
    motherOccupation: "Homemaker",
    currentAddress: "33 MG Road, Jaipur",
    permanentAddress: "33 MG Road, Jaipur",
    transportOptIn: true,
    transportRoute: "Route #14",
  },
  {
    admissionNumber: "2024-NX-055",
    firstName: "Ananya",
    lastName: "Iyer",
    gender: "FEMALE",
    status: "ACTIVE",
    email: "ananya.iyer@nexus.edu",
    mobile: "+91 98765 01055",
    dateOfBirth: "2012-01-28",
    admissionDate: "2024-04-01",
    bloodGroup: "A-",
    religion: "Hinduism",
    nationality: "Indian",
    rollNumber: "55",
    className: "Class 8",
    sectionName: "A",
    categoryName: "General",
    houseName: "White House",
    fatherName: "Suresh Iyer",
    fatherPhone: "+91 98765 11055",
    fatherEmail: "suresh.iyer@example.com",
    fatherOccupation: "Professor",
    motherName: "Kavitha Iyer",
    motherPhone: "+91 98765 21055",
    motherEmail: "kavitha.iyer@example.com",
    motherOccupation: "Scientist",
    currentAddress: "9 Lake Palace, Kochi",
    permanentAddress: "9 Lake Palace, Kochi",
  },
  {
    admissionNumber: "2024-NX-061",
    firstName: "Rohan",
    lastName: "Mehta",
    gender: "MALE",
    status: "ALUMNI",
    email: "rohan.mehta@nexus.edu",
    mobile: "+91 98765 01061",
    dateOfBirth: "2006-03-08",
    admissionDate: "2018-04-01",
    bloodGroup: "B-",
    religion: "Hinduism",
    nationality: "Indian",
    rollNumber: "61",
    className: "Class 12",
    sectionName: "A",
    categoryName: "General",
    houseName: "Blue House",
    fatherName: "Vikram Mehta",
    fatherPhone: "+91 98765 11061",
    fatherEmail: "vikram.mehta@example.com",
    fatherOccupation: "Entrepreneur",
    motherName: "Neha Mehta",
    motherPhone: "+91 98765 21061",
    motherEmail: "neha.mehta@example.com",
    motherOccupation: "Consultant",
    currentAddress: "101 Skyline Towers, Mumbai",
    permanentAddress: "101 Skyline Towers, Mumbai",
  },
  {
    admissionNumber: "2024-NX-077",
    firstName: "Fatima",
    lastName: "Khan",
    gender: "FEMALE",
    status: "ACTIVE",
    email: "fatima.khan@nexus.edu",
    mobile: "+91 98765 01077",
    dateOfBirth: "2010-07-19",
    admissionDate: "2023-04-01",
    bloodGroup: "O-",
    religion: "Islam",
    nationality: "Indian",
    rollNumber: "77",
    className: "Class 10",
    sectionName: "B",
    categoryName: "Reserved",
    houseName: "White House",
    fatherName: "Imran Khan",
    fatherPhone: "+91 98765 11077",
    fatherEmail: "imran.khan@example.com",
    fatherOccupation: "Merchant",
    motherName: "Ayesha Khan",
    motherPhone: "+91 98765 21077",
    motherEmail: "ayesha.khan@example.com",
    motherOccupation: "Nurse",
    currentAddress: "72 Green Park, Delhi",
    permanentAddress: "72 Green Park, Delhi",
    admissionType: "TRANSFER",
  },
  {
    admissionNumber: "2024-NX-088",
    firstName: "Kabir",
    lastName: "Singh",
    gender: "MALE",
    status: "ACTIVE",
    email: "kabir.singh@nexus.edu",
    mobile: "+91 98765 01088",
    dateOfBirth: "2009-12-01",
    admissionDate: "2023-04-01",
    bloodGroup: "A+",
    religion: "Sikhism",
    nationality: "Indian",
    rollNumber: "88",
    className: "Class 11",
    sectionName: "B",
    categoryName: "General",
    houseName: "Blue House",
    fatherName: "Harpreet Singh",
    fatherPhone: "+91 98765 11088",
    fatherEmail: "harpreet.singh@example.com",
    fatherOccupation: "Army Officer",
    motherName: "Simran Singh",
    motherPhone: "+91 98765 21088",
    motherEmail: "simran.singh@example.com",
    motherOccupation: "Pharmacist",
    currentAddress: "15 Cantonment Road, Chandigarh",
    permanentAddress: "15 Cantonment Road, Chandigarh",
  },
  {
    admissionNumber: "2024-NX-095",
    firstName: "Maya",
    lastName: "Patel",
    gender: "FEMALE",
    status: "DISABLED",
    email: "maya.patel@nexus.edu",
    mobile: "+91 98765 01095",
    dateOfBirth: "2011-04-22",
    admissionDate: "2024-04-01",
    bloodGroup: "AB-",
    religion: "Hinduism",
    nationality: "Indian",
    rollNumber: "95",
    className: "Class 9",
    sectionName: "B",
    categoryName: "General",
    houseName: "White House",
    fatherName: "Nilesh Patel",
    fatherPhone: "+91 98765 11095",
    fatherEmail: "nilesh.patel@example.com",
    fatherOccupation: "Trader",
    motherName: "Rina Patel",
    motherPhone: "+91 98765 21095",
    motherEmail: "rina.patel@example.com",
    motherOccupation: "Homemaker",
    currentAddress: "44 Ring Road, Ahmedabad",
    permanentAddress: "44 Ring Road, Ahmedabad",
    disabledReason: "Transferred out",
  },
];

const PENDING_ADMISSIONS = [
  {
    firstName: "Noah",
    lastName: "Williams",
    gender: "MALE" as Gender,
    mobile: "+91 98000 10001",
    email: "noah.williams@example.com",
    fatherName: "James Williams",
    motherName: "Emma Williams",
    guardianPhone: "+91 98000 10002",
    currentAddress: "12 Cedar Street, Bengaluru",
    className: "Class 10",
    sectionName: "A",
  },
  {
    firstName: "Ishita",
    lastName: "Verma",
    gender: "FEMALE" as Gender,
    mobile: "+91 98000 10003",
    email: "ishita.verma@example.com",
    fatherName: "Amit Verma",
    motherName: "Sneha Verma",
    guardianPhone: "+91 98000 10004",
    currentAddress: "8 Lotus Colony, Lucknow",
    className: "Class 11",
    sectionName: "A",
  },
  {
    firstName: "Dev",
    lastName: "Nair",
    gender: "MALE" as Gender,
    mobile: "+91 98000 10005",
    email: "dev.nair@example.com",
    fatherName: "Ravi Nair",
    motherName: "Lakshmi Nair",
    guardianPhone: "+91 98000 10006",
    currentAddress: "27 Beach Road, Trivandrum",
    className: "Class 9",
    sectionName: "A",
  },
];

async function ensureCategory(tenantId: string, name: string) {
  return prisma.studentCategory.upsert({
    where: { tenantId_name: { tenantId, name } },
    update: {},
    create: { tenantId, name },
  });
}

async function ensureHouse(tenantId: string, name: string) {
  return prisma.studentHouse.upsert({
    where: { tenantId_name: { tenantId, name } },
    update: {},
    create: { tenantId, name },
  });
}

async function ensureClassSection(
  tenantId: string,
  sessionId: string,
  className: string,
  sectionName: string,
  sortOrder: number,
) {
  const academicClass = await prisma.academicClass.upsert({
    where: { tenantId_name: { tenantId, name: className } },
    update: { sortOrder },
    create: {
      tenantId,
      name: className,
      code: className.replace(/\D/g, "") || className,
      sortOrder,
    },
  });
  const section = await prisma.section.upsert({
    where: { tenantId_name: { tenantId, name: sectionName } },
    update: {},
    create: { tenantId, name: sectionName },
  });
  return prisma.classSection.upsert({
    where: {
      tenantId_academicSessionId_classId_sectionId: {
        tenantId,
        academicSessionId: sessionId,
        classId: academicClass.id,
        sectionId: section.id,
      },
    },
    update: {},
    create: {
      tenantId,
      academicSessionId: sessionId,
      classId: academicClass.id,
      sectionId: section.id,
    },
  });
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-school" } });
  if (!tenant) {
    throw new Error('Tenant "demo-school" not found. Run `npm run db:seed` first.');
  }
  const tenantId = tenant.id;

  let session = await prisma.academicSession.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
  });
  session ??= await prisma.academicSession.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { startDate: "desc" },
  });
  if (!session) {
    throw new Error("No academic session found for demo-school. Run full seed first.");
  }

  await ensureCategory(tenant.id, "General");
  await ensureCategory(tenant.id, "Reserved");
  await ensureHouse(tenant.id, "Blue House");
  await ensureHouse(tenant.id, "White House");
  await prisma.disableReason.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Long leave / medical" } },
    update: {},
    create: { tenantId: tenant.id, name: "Long leave / medical" },
  });
  await prisma.disableReason.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Transferred out" } },
    update: {},
    create: { tenantId: tenant.id, name: "Transferred out" },
  });

  const classCache = new Map<string, string>();
  async function classSectionId(className: string, sectionName: string) {
    const key = `${className}::${sectionName}`;
    if (classCache.has(key)) return classCache.get(key)!;
    const sortOrder = Number(className.replace(/\D/g, "")) || 0;
    const cs = await ensureClassSection(tenantId, session!.id, className, sectionName, sortOrder);
    classCache.set(key, cs.id);
    return cs.id;
  }

  let createdStudents = 0;
  let updatedStudents = 0;

  for (const item of STUDENTS) {
    const category = await ensureCategory(tenant.id, item.categoryName);
    const house = await ensureHouse(tenant.id, item.houseName);
    const csId = await classSectionId(item.className, item.sectionName);

    const existing = await prisma.student.findUnique({
      where: {
        tenantId_admissionNumber: {
          tenantId: tenant.id,
          admissionNumber: item.admissionNumber,
        },
      },
    });

    const data = {
      firstName: item.firstName,
      lastName: item.lastName,
      gender: item.gender,
      status: item.status,
      email: item.email,
      mobile: item.mobile,
      dateOfBirth: new Date(`${item.dateOfBirth}T00:00:00.000Z`),
      admissionDate: new Date(`${item.admissionDate}T00:00:00.000Z`),
      bloodGroup: item.bloodGroup,
      religion: item.religion,
      nationality: item.nationality,
      categoryId: category.id,
      houseId: house.id,
      fatherName: item.fatherName,
      fatherPhone: item.fatherPhone,
      fatherEmail: item.fatherEmail,
      fatherOccupation: item.fatherOccupation,
      motherName: item.motherName,
      motherPhone: item.motherPhone,
      motherEmail: item.motherEmail,
      motherOccupation: item.motherOccupation,
      currentAddress: item.currentAddress,
      permanentAddress: item.permanentAddress,
      admissionType: item.admissionType ?? "REGULAR",
      rteEnabled: item.rteEnabled ?? false,
      rteSchemeName: item.rteEnabled ? "RTE Act Scheme" : null,
      transportOptIn: item.transportOptIn ?? false,
      transportRoute: item.transportRoute ?? null,
      disabledReason: item.disabledReason ?? null,
    };

    const student = existing
      ? await prisma.student.update({ where: { id: existing.id }, data })
      : await prisma.student.create({
          data: {
            tenantId: tenant.id,
            admissionNumber: item.admissionNumber,
            ...data,
          },
        });

    if (existing) updatedStudents += 1;
    else createdStudents += 1;

    await prisma.studentEnrollment.upsert({
      where: {
        tenantId_studentId_academicSessionId_classSectionId: {
          tenantId: tenant.id,
          studentId: student.id,
          academicSessionId: session.id,
          classSectionId: csId,
        },
      },
      update: { rollNumber: item.rollNumber, status: "ACTIVE" },
      create: {
        tenantId: tenant.id,
        studentId: student.id,
        academicSessionId: session.id,
        classSectionId: csId,
        rollNumber: item.rollNumber,
        status: "ACTIVE",
      },
    });
  }

  // Link two siblings (Holloway family demo — Marcus + fictional sibling already in list? Link Sharma siblings if same father phone)
  // Link Aarav Sharma as sibling group with a second entry if needed — skip complex; set shared group for Holloway/Rodriguez optional.
  const siblingGroupId = `sib-demo-${tenant.id.slice(-6)}`;
  const aarav = await prisma.student.findUnique({
    where: { tenantId_admissionNumber: { tenantId: tenant.id, admissionNumber: "2024-NX-042" } },
  });
  const ananya = await prisma.student.findUnique({
    where: { tenantId_admissionNumber: { tenantId: tenant.id, admissionNumber: "2024-NX-055" } },
  });
  if (aarav && ananya) {
    await prisma.student.updateMany({
      where: { id: { in: [aarav.id, ananya.id] } },
      data: { siblingGroupId },
    });
  }

  let pendingCreated = 0;
  for (const application of PENDING_ADMISSIONS) {
    const csId = await classSectionId(application.className, application.sectionName);
    const already = await prisma.onlineAdmissionApplication.findFirst({
      where: {
        tenantId: tenant.id,
        email: application.email,
        status: "PENDING",
      },
    });
    if (already) continue;
    await prisma.onlineAdmissionApplication.create({
      data: {
        tenantId: tenant.id,
        academicSessionId: session.id,
        classSectionId: csId,
        status: "PENDING",
        firstName: application.firstName,
        lastName: application.lastName,
        gender: application.gender,
        mobile: application.mobile,
        email: application.email,
        fatherName: application.fatherName,
        motherName: application.motherName,
        guardianPhone: application.guardianPhone,
        currentAddress: application.currentAddress,
        dateOfBirth: new Date("2011-01-15T00:00:00.000Z"),
      },
    });
    pendingCreated += 1;
  }

  const totalStudents = await prisma.student.count({ where: { tenantId: tenant.id } });
  const pendingCount = await prisma.onlineAdmissionApplication.count({
    where: { tenantId: tenant.id, status: "PENDING" },
  });

  console.log("Student demo data ready for demo-school:");
  console.log(`  students created: ${createdStudents}`);
  console.log(`  students updated: ${updatedStudents}`);
  console.log(`  pending admissions created: ${pendingCreated}`);
  console.log(`  total students now: ${totalStudents}`);
  console.log(`  pending admissions now: ${pendingCount}`);
  console.log("");
  console.log("Login (Institution Admin):");
  console.log(`  slug:     ${tenant.slug}`);
  console.log(`  email:    ${(process.env.DEMO_ADMIN_EMAIL ?? "admin@demo-school.local").toLowerCase()}`);
  console.log(`  password: ${process.env.DEMO_ADMIN_PASSWORD ?? "11111111"}`);
  console.log("  URL:      http://localhost:5173/login");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
