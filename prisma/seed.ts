import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  ProductMode,
  TenantType,
  DistributionModel,
} from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
  ["platform.manage", "Manage the SaaS CMS LMS platform"],
  ["tenants.manage", "Create and administer tenants"],
  ["settings.view", "View tenant settings"],
  ["settings.manage", "Manage tenant settings"],
  ["users.view", "View tenant users"],
  ["users.manage", "Manage tenant users"],
  ["roles.view", "View roles and permissions"],
  ["roles.manage", "Manage roles and permissions"],
  ["sessions.view", "View academic sessions"],
  ["sessions.manage", "Manage academic sessions"],
  ["students.view", "View students and enrolments"],
  ["students.manage", "Manage students and enrolments"],
  ["academics.view", "View academic structure"],
  ["academics.manage", "Manage academic structure"],
  ["fees.view", "View fees, dues, receipts, and reports"],
  ["fees.manage", "Manage fee setup and assignments"],
  ["fees.collect", "Collect and revert fee payments"],
  ["attendance.view", "View student attendance and reports"],
  ["attendance.manage", "Mark attendance, review leave, and award points"],
  ["exams.view", "View exam schedules, results, and print records"],
  ["exams.manage", "Manage exams, students, schedules, and marks"],
  ["exams.publish", "Publish examination results"],
  ["hr.view", "View staff, attendance, leave, ratings, and payroll"],
  ["hr.manage", "Manage staff, attendance, leave, and ratings"],
  ["payroll.manage", "Generate and pay staff payroll"],
  ["documents.view", "View templates and generated documents"],
  ["documents.manage", "Design certificate, ID card, and exam templates"],
  ["documents.generate", "Generate certificates, ID cards, admit cards, and marksheets"],
  ["reports.view", "View consolidated module reports and audit trail"],
  ["timetable.view", "View class and teacher timetables"],
  ["timetable.manage", "Create and manage timetable periods"],
  ["homework.view", "View homework, submissions, and reports"],
  ["homework.manage", "Create and manage homework assignments"],
  ["homework.submit", "Submit and resubmit homework"],
  ["homework.evaluate", "Evaluate homework and request resubmission"],
  ["erp.view", "View ERP configuration"],
  ["erp.manage", "Manage ERP configuration"],
  ["erp.backup", "Create and restore tenant configuration backups"],
] as const;

async function main() {
  const passwordRounds = 12;
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "admin@saas-cms-lms.local").toLowerCase();
  const demoAdminEmail = (process.env.DEMO_ADMIN_EMAIL ?? "admin@demo-school.local").toLowerCase();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD ?? "ChangeMe123!";

  const permissionRecords = await Promise.all(
    permissions.map(([key, description]) =>
      prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      }),
    ),
  );

  let superAdminRole = await prisma.role.findFirst({
    where: { tenantId: null, code: "UNIVERSE_SUPER_ADMIN" },
  });
  superAdminRole ??= await prisma.role.create({
    data: {
      code: "UNIVERSE_SUPER_ADMIN",
      name: "Universe Super Admin",
      isSystem: true,
    },
  });

  await Promise.all(
    permissionRecords.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: permission.id },
      }),
    ),
  );

  let superAdmin = await prisma.user.findFirst({
    where: { tenantId: null, resellerId: null, email: superAdminEmail },
  });
  const superAdminData = {
    email: superAdminEmail,
    passwordHash: await bcrypt.hash(superAdminPassword, passwordRounds),
    firstName: "Universe",
    lastName: "Administrator",
  };
  superAdmin = superAdmin
    ? await prisma.user.update({ where: { id: superAdmin.id }, data: superAdminData })
    : await prisma.user.create({ data: superAdminData });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    update: { tenantId: null },
    create: { userId: superAdmin.id, roleId: superAdminRole.id },
  });

  const demoTenant = await prisma.tenant.upsert({
    where: { slug: "demo-school" },
    update: {
      name: "SaaS CMS LMS Demo School",
      type: TenantType.SCHOOL,
      productMode: ProductMode.BOTH,
    },
    create: {
      name: "SaaS CMS LMS Demo School",
      slug: "demo-school",
      type: TenantType.SCHOOL,
      productMode: ProductMode.BOTH,
      distributionModel: DistributionModel.UNIVERSE_AI,
      branding: { primaryColor: "#4f46e5", logoText: "SaaS CMS LMS" },
    },
  });

  const demoReseller = await prisma.reseller.upsert({
    where: { slug: "bright-edu-partners" },
    update: { name: "Bright Edu Partners" },
    create: {
      name: "Bright Edu Partners",
      slug: "bright-edu-partners",
      branding: { primaryColor: "#0ea5e9", logoText: "Bright Edu" },
    },
  });

  await prisma.tenant.upsert({
    where: { slug: "sunrise-coaching" },
    update: { name: "Sunrise Coaching Center", resellerId: demoReseller.id },
    create: {
      name: "Sunrise Coaching Center",
      slug: "sunrise-coaching",
      type: TenantType.COACHING_CENTER,
      productMode: ProductMode.BOTH,
      distributionModel: DistributionModel.RESELLER,
      resellerId: demoReseller.id,
      branding: { primaryColor: "#f97316", logoText: "Sunrise" },
    },
  });

  await prisma.tenant.upsert({
    where: { slug: "individual-aarohi" },
    update: { name: "Aarohi (Individual Learner)" },
    create: {
      name: "Aarohi (Individual Learner)",
      slug: "individual-aarohi",
      type: TenantType.INDIVIDUAL,
      productMode: ProductMode.LMS,
      distributionModel: DistributionModel.UNIVERSE_AI,
    },
  });

  const institutionRole = await prisma.role.upsert({
    where: {
      tenantId_code: {
        tenantId: demoTenant.id,
        code: "INSTITUTION_ADMIN",
      },
    },
    update: { name: "Institution Admin" },
    create: {
      tenantId: demoTenant.id,
      code: "INSTITUTION_ADMIN",
      name: "Institution Admin",
      isSystem: true,
    },
  });

  await Promise.all(
    permissionRecords
      .filter(({ key }) => key !== "platform.manage" && key !== "tenants.manage")
      .map((permission) =>
        prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: institutionRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: { roleId: institutionRole.id, permissionId: permission.id },
        }),
      ),
  );

  const demoAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: demoAdminEmail,
      },
    },
    update: {
      passwordHash: await bcrypt.hash(demoAdminPassword, passwordRounds),
      firstName: "Demo",
      lastName: "Administrator",
    },
    create: {
      tenantId: demoTenant.id,
      email: demoAdminEmail,
      passwordHash: await bcrypt.hash(demoAdminPassword, passwordRounds),
      firstName: "Demo",
      lastName: "Administrator",
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoAdmin.id, roleId: institutionRole.id } },
    update: { tenantId: demoTenant.id },
    create: {
      userId: demoAdmin.id,
      roleId: institutionRole.id,
      tenantId: demoTenant.id,
    },
  });

  const currentSession = await prisma.academicSession.upsert({
    where: {
      tenantId_name: {
        tenantId: demoTenant.id,
        name: "2026-2027",
      },
    },
    update: { isCurrent: true },
    create: {
      tenantId: demoTenant.id,
      name: "2026-2027",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2027-03-31T00:00:00.000Z"),
      isCurrent: true,
    },
  });

  await prisma.tenantSetting.upsert({
    where: { tenantId: demoTenant.id },
    update: {
      autoStaffNumber: true,
      staffPrefix: "STF-",
      examResultType: "SCHOOL_GRADING",
      onlineAdmission: true,
    },
    create: {
      tenantId: demoTenant.id,
      email: "office@demo-school.local",
      phone: "+91 90000 00000",
      currency: "INR",
      timezone: "Asia/Kolkata",
      autoAdmissionNumber: true,
      admissionPrefix: "SCL-",
      nextAdmissionNumber: 2,
      autoStaffNumber: true,
      staffPrefix: "STF-",
      examResultType: "SCHOOL_GRADING",
      onlineAdmission: true,
    },
  });

  const permissionByKey = new Map(permissionRecords.map((permission) => [permission.key, permission]));
  const roleDefinitions = [
    {
      code: "TEACHER",
      name: "Teacher",
      permissions: [
        "students.view",
        "academics.view",
        "sessions.view",
        "attendance.view",
        "attendance.manage",
        "exams.view",
        "exams.manage",
        "documents.view",
        "documents.generate",
        "timetable.view",
        "homework.view",
        "homework.manage",
        "homework.evaluate",
      ],
    },
    {
      code: "ACCOUNTANT",
      name: "Accountant",
      permissions: [
        "students.view",
        "sessions.view",
        "fees.view",
        "fees.manage",
        "fees.collect",
        "hr.view",
        "payroll.manage",
        "reports.view",
      ],
    },
    {
      code: "STAFF",
      name: "Staff",
      permissions: [
        "students.view",
        "academics.view",
        "sessions.view",
        "attendance.view",
        "attendance.manage",
        "hr.view",
        "timetable.view",
        "timetable.manage",
        "homework.view",
        "homework.manage",
        "homework.evaluate",
      ],
    },
    {
      code: "STUDENT",
      name: "Student",
      permissions: ["timetable.view", "homework.view", "homework.submit"],
    },
    {
      code: "PARENT",
      name: "Parent",
      permissions: ["timetable.view", "homework.view"],
    },
  ] as const;

  const tenantRoles = new Map<string, { id: string }>();
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: {
        tenantId_code: { tenantId: demoTenant.id, code: definition.code },
      },
      update: { name: definition.name },
      create: {
        tenantId: demoTenant.id,
        code: definition.code,
        name: definition.name,
        isSystem: true,
      },
    });
    tenantRoles.set(definition.code, role);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const key of definition.permissions) {
      const permission = permissionByKey.get(key);
      if (permission) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }

  const teacherRole = tenantRoles.get("TEACHER")!;
  const teacherEmail = "teacher@demo-school.local";
  const teacher = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: demoTenant.id, email: teacherEmail },
    },
    update: { firstName: "Anita", lastName: "Sharma" },
    create: {
      tenantId: demoTenant.id,
      email: teacherEmail,
      passwordHash: await bcrypt.hash("ChangeMe123!", passwordRounds),
      firstName: "Anita",
      lastName: "Sharma",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: teacher.id, roleId: teacherRole.id } },
    update: { tenantId: demoTenant.id },
    create: { userId: teacher.id, roleId: teacherRole.id, tenantId: demoTenant.id },
  });

  const generalCategory = await prisma.studentCategory.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "General" } },
    update: {},
    create: { tenantId: demoTenant.id, name: "General" },
  });
  const blueHouse = await prisma.studentHouse.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Blue House" } },
    update: {},
    create: { tenantId: demoTenant.id, name: "Blue House" },
  });
  const academicClass = await prisma.academicClass.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Class 10" } },
    update: { code: "10", sortOrder: 10 },
    create: {
      tenantId: demoTenant.id,
      name: "Class 10",
      code: "10",
      sortOrder: 10,
    },
  });
  const section = await prisma.section.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "A" } },
    update: {},
    create: { tenantId: demoTenant.id, name: "A" },
  });
  const mathematics = await prisma.subject.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Mathematics" } },
    update: { code: "MATH" },
    create: {
      tenantId: demoTenant.id,
      name: "Mathematics",
      code: "MATH",
    },
  });
  const classSection = await prisma.classSection.upsert({
    where: {
      tenantId_academicSessionId_classId_sectionId: {
        tenantId: demoTenant.id,
        academicSessionId: currentSession.id,
        classId: academicClass.id,
        sectionId: section.id,
      },
    },
    update: { classTeacherId: teacher.id },
    create: {
      tenantId: demoTenant.id,
      academicSessionId: currentSession.id,
      classId: academicClass.id,
      sectionId: section.id,
      classTeacherId: teacher.id,
    },
  });
  const classSubject = await prisma.classSubject.upsert({
    where: {
      tenantId_classSectionId_subjectId: {
        tenantId: demoTenant.id,
        classSectionId: classSection.id,
        subjectId: mathematics.id,
      },
    },
    update: { teacherId: teacher.id },
    create: {
      tenantId: demoTenant.id,
      classSectionId: classSection.id,
      subjectId: mathematics.id,
      teacherId: teacher.id,
    },
  });

  const demoStudent = await prisma.student.upsert({
    where: {
      tenantId_admissionNumber: {
        tenantId: demoTenant.id,
        admissionNumber: "SCL-1",
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      admissionNumber: "SCL-1",
      firstName: "Aarav",
      lastName: "Kumar",
      gender: "MALE",
      admissionDate: new Date("2026-04-01T00:00:00.000Z"),
      categoryId: generalCategory.id,
      houseId: blueHouse.id,
      guardianName: "Raj Kumar",
      guardianRelation: "Father",
      guardianPhone: "+91 91111 11111",
    },
  });
  const demoEnrollment = await prisma.studentEnrollment.upsert({
    where: {
      tenantId_studentId_academicSessionId_classSectionId: {
        tenantId: demoTenant.id,
        studentId: demoStudent.id,
        academicSessionId: currentSession.id,
        classSectionId: classSection.id,
      },
    },
    update: { rollNumber: "1" },
    create: {
      tenantId: demoTenant.id,
      studentId: demoStudent.id,
      academicSessionId: currentSession.id,
      classSectionId: classSection.id,
      rollNumber: "1",
    },
  });

  const studentRole = tenantRoles.get("STUDENT")!;
  const parentRole = tenantRoles.get("PARENT")!;
  const accountantRole = tenantRoles.get("ACCOUNTANT")!;

  const studentLastName = demoStudent.lastName ?? "Kumar";
  const studentUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: "student@demo-school.local" } },
    update: { firstName: demoStudent.firstName, lastName: studentLastName },
    create: {
      tenantId: demoTenant.id,
      email: "student@demo-school.local",
      passwordHash: await bcrypt.hash("ChangeMe123!", passwordRounds),
      firstName: demoStudent.firstName,
      lastName: studentLastName,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: studentUser.id, roleId: studentRole.id } },
    update: { tenantId: demoTenant.id },
    create: { userId: studentUser.id, roleId: studentRole.id, tenantId: demoTenant.id },
  });
  await prisma.student.update({
    where: { id: demoStudent.id },
    data: { userId: studentUser.id },
  });

  const parentUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: "parent@demo-school.local" } },
    update: { firstName: "Raj", lastName: "Kumar" },
    create: {
      tenantId: demoTenant.id,
      email: "parent@demo-school.local",
      passwordHash: await bcrypt.hash("ChangeMe123!", passwordRounds),
      firstName: "Raj",
      lastName: "Kumar",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: parentUser.id, roleId: parentRole.id } },
    update: { tenantId: demoTenant.id },
    create: { userId: parentUser.id, roleId: parentRole.id, tenantId: demoTenant.id },
  });
  await prisma.studentGuardian.upsert({
    where: {
      tenantId_studentId_userId: {
        tenantId: demoTenant.id,
        studentId: demoStudent.id,
        userId: parentUser.id,
      },
    },
    update: { relation: "Father", isPrimary: true },
    create: {
      tenantId: demoTenant.id,
      studentId: demoStudent.id,
      userId: parentUser.id,
      relation: "Father",
      isPrimary: true,
    },
  });

  const accountantUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: "accountant@demo-school.local" } },
    update: { firstName: "Meera", lastName: "Nair" },
    create: {
      tenantId: demoTenant.id,
      email: "accountant@demo-school.local",
      passwordHash: await bcrypt.hash("ChangeMe123!", passwordRounds),
      firstName: "Meera",
      lastName: "Nair",
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: accountantUser.id, roleId: accountantRole.id } },
    update: { tenantId: demoTenant.id },
    create: { userId: accountantUser.id, roleId: accountantRole.id, tenantId: demoTenant.id },
  });

  const monthlyFee = await prisma.feeType.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Monthly Fee" } },
    update: { code: "MONTHLY", isActive: true },
    create: {
      tenantId: demoTenant.id,
      name: "Monthly Fee",
      code: "MONTHLY",
      description: "Regular monthly tuition fee",
    },
  });
  const standardGroup = await prisma.feeGroup.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Standard Fees" } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: "Standard Fees",
      description: "Default class fee group",
    },
  });
  await prisma.feeGroupItem.upsert({
    where: {
      feeGroupId_feeTypeId: {
        feeGroupId: standardGroup.id,
        feeTypeId: monthlyFee.id,
      },
    },
    update: {},
    create: { feeGroupId: standardGroup.id, feeTypeId: monthlyFee.id },
  });
  await prisma.feeDiscount.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Sibling Discount" } },
    update: { type: "PERCENTAGE", value: 10, isActive: true },
    create: {
      tenantId: demoTenant.id,
      name: "Sibling Discount",
      type: "PERCENTAGE",
      value: 10,
    },
  });
  await prisma.feeReceiptBook.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Main Receipt Book" } },
    update: { isDefault: true },
    create: {
      tenantId: demoTenant.id,
      name: "Main Receipt Book",
      prefix: "SCL-R-",
      isDefault: true,
    },
  });
  await prisma.tenantFeeSetting.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      autoReminder: true,
      reminderDaysBefore: 3,
      reminderDaysAfter: 1,
    },
  });
  const feeMaster = await prisma.feeMaster.upsert({
    where: {
      tenantId_academicSessionId_classSectionId_feeGroupId_feeTypeId_dueDate: {
        tenantId: demoTenant.id,
        academicSessionId: currentSession.id,
        classSectionId: classSection.id,
        feeGroupId: standardGroup.id,
        feeTypeId: monthlyFee.id,
        dueDate: new Date("2026-07-31T00:00:00.000Z"),
      },
    },
    update: { amount: 2000 },
    create: {
      tenantId: demoTenant.id,
      academicSessionId: currentSession.id,
      classSectionId: classSection.id,
      feeGroupId: standardGroup.id,
      feeTypeId: monthlyFee.id,
      amount: 2000,
      dueDate: new Date("2026-07-31T00:00:00.000Z"),
      fineType: "FIXED",
      fineValue: 100,
      graceDays: 3,
    },
  });
  await prisma.studentFeeAssignment.upsert({
    where: {
      tenantId_studentEnrollmentId_feeMasterId: {
        tenantId: demoTenant.id,
        studentEnrollmentId: demoEnrollment.id,
        feeMasterId: feeMaster.id,
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      studentEnrollmentId: demoEnrollment.id,
      feeMasterId: feeMaster.id,
    },
  });
  await prisma.attendanceRecord.upsert({
    where: {
      tenantId_studentEnrollmentId_attendanceDate_periodKey: {
        tenantId: demoTenant.id,
        studentEnrollmentId: demoEnrollment.id,
        attendanceDate: new Date("2026-07-17T00:00:00.000Z"),
        periodKey: "DAY",
      },
    },
    update: { status: "PRESENT", markedById: teacher.id },
    create: {
      tenantId: demoTenant.id,
      studentEnrollmentId: demoEnrollment.id,
      academicSessionId: currentSession.id,
      classSectionId: classSection.id,
      attendanceDate: new Date("2026-07-17T00:00:00.000Z"),
      periodKey: "DAY",
      status: "PRESENT",
      inTime: "08:00",
      markedById: teacher.id,
    },
  });

  const teachingDepartment = await prisma.department.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Teaching" } },
    update: {},
    create: { tenantId: demoTenant.id, name: "Teaching" },
  });
  const teacherDesignation = await prisma.designation.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Senior Teacher" } },
    update: {},
    create: { tenantId: demoTenant.id, name: "Senior Teacher" },
  });
  const casualLeave = await prisma.staffLeaveType.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: "Casual Leave" } },
    update: { annualLimit: 12 },
    create: { tenantId: demoTenant.id, name: "Casual Leave", annualLimit: 12 },
  });
  const teacherStaff = await prisma.staffProfile.upsert({
    where: { userId: teacher.id },
    update: {
      departmentId: teachingDepartment.id,
      designationId: teacherDesignation.id,
      basicSalary: 45000,
      status: "ACTIVE",
    },
    create: {
      tenantId: demoTenant.id,
      userId: teacher.id,
      employeeNumber: "SCL-STF-001",
      departmentId: teachingDepartment.id,
      designationId: teacherDesignation.id,
      joiningDate: new Date("2024-04-01T00:00:00.000Z"),
      dateOfBirth: new Date("1990-08-15T00:00:00.000Z"),
      phone: "+91 92222 22222",
      basicSalary: 45000,
    },
  });
  await prisma.staffAttendance.upsert({
    where: {
      tenantId_staffId_attendanceDate: {
        tenantId: demoTenant.id,
        staffId: teacherStaff.id,
        attendanceDate: new Date("2026-07-17T00:00:00.000Z"),
      },
    },
    update: { status: "PRESENT", inTime: "07:45", outTime: "15:30" },
    create: {
      tenantId: demoTenant.id,
      staffId: teacherStaff.id,
      attendanceDate: new Date("2026-07-17T00:00:00.000Z"),
      status: "PRESENT",
      inTime: "07:45",
      outTime: "15:30",
      markedById: demoAdmin.id,
    },
  });
  let allowance = await prisma.staffAdjustment.findFirst({
    where: {
      tenantId: demoTenant.id,
      staffId: teacherStaff.id,
      name: "Transport Allowance",
    },
  });
  allowance = allowance
    ? await prisma.staffAdjustment.update({
        where: { id: allowance.id },
        data: { type: "EARNING", amount: 2000, isRecurring: true, isActive: true },
      })
    : await prisma.staffAdjustment.create({
        data: {
          tenantId: demoTenant.id,
          staffId: teacherStaff.id,
          name: "Transport Allowance",
          type: "EARNING",
          amount: 2000,
          isRecurring: true,
        },
      });
  const payroll = await prisma.payroll.upsert({
    where: {
      tenantId_staffId_payrollMonth: {
        tenantId: demoTenant.id,
        staffId: teacherStaff.id,
        payrollMonth: new Date("2026-07-01T00:00:00.000Z"),
      },
    },
    update: {
      basicSalary: 45000,
      grossAmount: 47000,
      netAmount: 47000,
      status: "GENERATED",
    },
    create: {
      tenantId: demoTenant.id,
      staffId: teacherStaff.id,
      academicSessionId: currentSession.id,
      payrollMonth: new Date("2026-07-01T00:00:00.000Z"),
      basicSalary: 45000,
      grossAmount: 47000,
      netAmount: 47000,
      status: "GENERATED",
    },
  });
  const payrollAllowance = await prisma.payrollItem.findFirst({
    where: { payrollId: payroll.id, name: allowance.name },
  });
  if (!payrollAllowance) {
    await prisma.payrollItem.create({
      data: {
        tenantId: demoTenant.id,
        payrollId: payroll.id,
        name: allowance.name,
        type: allowance.type,
        amount: allowance.amount,
      },
    });
  }
  const existingLeave = await prisma.staffLeave.findFirst({
    where: {
      tenantId: demoTenant.id,
      staffId: teacherStaff.id,
      leaveTypeId: casualLeave.id,
      fromDate: new Date("2026-07-20T00:00:00.000Z"),
    },
  });
  if (!existingLeave) {
    await prisma.staffLeave.create({
      data: {
        tenantId: demoTenant.id,
        staffId: teacherStaff.id,
        leaveTypeId: casualLeave.id,
        fromDate: new Date("2026-07-20T00:00:00.000Z"),
        toDate: new Date("2026-07-20T00:00:00.000Z"),
        reason: "Personal appointment",
      },
    });
  }

  const gradeDefinitions = [
    { name: "A+", minPercent: 90, maxPercent: 100, gradePoint: 10, passStatus: "PASS" as const },
    { name: "A", minPercent: 75, maxPercent: 89.99, gradePoint: 9, passStatus: "PASS" as const },
    { name: "B", minPercent: 60, maxPercent: 74.99, gradePoint: 8, passStatus: "PASS" as const },
    { name: "C", minPercent: 40, maxPercent: 59.99, gradePoint: 6, passStatus: "PASS" as const },
    { name: "F", minPercent: 0, maxPercent: 39.99, gradePoint: 0, passStatus: "FAIL" as const },
  ];
  for (const grade of gradeDefinitions) {
    await prisma.examGrade.upsert({
      where: {
        tenantId_resultType_name: {
          tenantId: demoTenant.id,
          resultType: "SCHOOL_GRADING",
          name: grade.name,
        },
      },
      update: grade,
      create: {
        tenantId: demoTenant.id,
        resultType: "SCHOOL_GRADING",
        ...grade,
      },
    });
  }
  const examGroup = await prisma.examGroup.upsert({
    where: {
      tenantId_academicSessionId_name: {
        tenantId: demoTenant.id,
        academicSessionId: currentSession.id,
        name: "Term 1",
      },
    },
    update: { resultType: "SCHOOL_GRADING" },
    create: {
      tenantId: demoTenant.id,
      academicSessionId: currentSession.id,
      name: "Term 1",
      resultType: "SCHOOL_GRADING",
      description: "First term examinations",
    },
  });
  const exam = await prisma.exam.upsert({
    where: {
      tenantId_examGroupId_name: {
        tenantId: demoTenant.id,
        examGroupId: examGroup.id,
        name: "Mid Term",
      },
    },
    update: {
      startDate: new Date("2026-07-20T00:00:00.000Z"),
      endDate: new Date("2026-07-25T00:00:00.000Z"),
      status: "PUBLISHED",
      publishedAt: new Date("2026-07-26T00:00:00.000Z"),
    },
    create: {
      tenantId: demoTenant.id,
      examGroupId: examGroup.id,
      name: "Mid Term",
      startDate: new Date("2026-07-20T00:00:00.000Z"),
      endDate: new Date("2026-07-25T00:00:00.000Z"),
      status: "PUBLISHED",
      publishedAt: new Date("2026-07-26T00:00:00.000Z"),
    },
  });
  const examSchedule = await prisma.examSchedule.upsert({
    where: {
      tenantId_examId_classSectionId_classSubjectId: {
        tenantId: demoTenant.id,
        examId: exam.id,
        classSectionId: classSection.id,
        classSubjectId: classSubject.id,
      },
    },
    update: {
      examDate: new Date("2026-07-20T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "12:00",
      maximumMarks: 100,
      minimumMarks: 40,
    },
    create: {
      tenantId: demoTenant.id,
      examId: exam.id,
      classSectionId: classSection.id,
      classSubjectId: classSubject.id,
      examDate: new Date("2026-07-20T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "12:00",
      room: "101",
      maximumMarks: 100,
      minimumMarks: 40,
    },
  });
  const examStudent = await prisma.examStudent.upsert({
    where: {
      tenantId_examId_studentEnrollmentId: {
        tenantId: demoTenant.id,
        examId: exam.id,
        studentEnrollmentId: demoEnrollment.id,
      },
    },
    update: { rollNumber: demoEnrollment.rollNumber },
    create: {
      tenantId: demoTenant.id,
      examId: exam.id,
      studentEnrollmentId: demoEnrollment.id,
      rollNumber: demoEnrollment.rollNumber,
    },
  });
  await prisma.examMark.upsert({
    where: {
      tenantId_scheduleId_examStudentId: {
        tenantId: demoTenant.id,
        scheduleId: examSchedule.id,
        examStudentId: examStudent.id,
      },
    },
    update: { marksObtained: 86, isAbsent: false, remarks: "Very good" },
    create: {
      tenantId: demoTenant.id,
      scheduleId: examSchedule.id,
      examStudentId: examStudent.id,
      marksObtained: 86,
      remarks: "Very good",
    },
  });

  const templateDefinitions = [
    {
      type: "ADMIT_CARD" as const,
      name: "Standard Admit Card",
      width: 1050,
      height: 1485,
      config: { title: "Examination Admit Card", showPhoto: true, showSchedule: true },
    },
    {
      type: "MARKSHEET" as const,
      name: "Standard Marksheet",
      width: 1050,
      height: 1485,
      config: { title: "Statement of Marks", showRank: true, showGrade: true },
    },
    {
      type: "CERTIFICATE" as const,
      name: "Achievement Certificate",
      width: 1600,
      height: 1131,
      config: { title: "Certificate of Achievement", showPhoto: false, showBarcode: true },
    },
    {
      type: "ID_CARD" as const,
      name: "Student ID Card",
      width: 638,
      height: 1011,
      config: { showPhoto: true, showClass: true, showBarcode: true },
    },
  ];
  for (const template of templateDefinitions) {
    await prisma.documentTemplate.upsert({
      where: {
        tenantId_type_name: {
          tenantId: demoTenant.id,
          type: template.type,
          name: template.name,
        },
      },
      update: template,
      create: { tenantId: demoTenant.id, ...template },
    });
  }
  const marksheetTemplate = await prisma.documentTemplate.findUniqueOrThrow({
    where: {
      tenantId_type_name: {
        tenantId: demoTenant.id,
        type: "MARKSHEET",
        name: "Standard Marksheet",
      },
    },
  });
  await prisma.generatedDocument.upsert({
    where: {
      tenantId_serialNumber: {
        tenantId: demoTenant.id,
        serialNumber: "MARKSHEET-2026-DEMO-001",
      },
    },
    update: {
      templateId: marksheetTemplate.id,
      studentId: demoStudent.id,
      examId: exam.id,
      barcodeValue: "SCL-MARKSHEET-DEMO-001",
    },
    create: {
      tenantId: demoTenant.id,
      templateId: marksheetTemplate.id,
      studentId: demoStudent.id,
      examId: exam.id,
      serialNumber: "MARKSHEET-2026-DEMO-001",
      barcodeValue: "SCL-MARKSHEET-DEMO-001",
      generatedById: demoAdmin.id,
      payload: {
        template: marksheetTemplate.config,
        student: {
          firstName: demoStudent.firstName,
          lastName: demoStudent.lastName,
          admissionNumber: demoStudent.admissionNumber,
          photoUrl: demoStudent.photoUrl,
          enrollments: [{
            academicSession: { name: currentSession.name },
            classSection: {
              academicClass: { name: academicClass.name },
              section: { name: section.name },
            },
          }],
        },
        exam: { name: exam.name, examGroup: { name: examGroup.name } },
        result: {
          marks: [{
            marksObtained: 86,
            isAbsent: false,
            schedule: {
              maximumMarks: 100,
              minimumMarks: 40,
              classSubject: { subject: { name: mathematics.name } },
            },
          }],
        },
        custom: {},
      },
    },
  });
  const auditExists = await prisma.auditLog.findFirst({
    where: { tenantId: demoTenant.id, action: "PHASE_3_SEEDED" },
  });
  if (!auditExists) {
    await prisma.auditLog.create({
      data: {
        tenantId: demoTenant.id,
        userId: demoAdmin.id,
        action: "PHASE_3_SEEDED",
        entityType: "SYSTEM",
        metadata: { modules: ["examinations", "hr", "payroll", "reports", "documents"] },
      },
    });
  }

  await prisma.timetableEntry.upsert({
    where: {
      tenantId_classSectionId_weekday_startTime: {
        tenantId: demoTenant.id,
        classSectionId: classSection.id,
        weekday: "MONDAY",
        startTime: "09:00",
      },
    },
    update: {
      classSubjectId: classSubject.id,
      teacherId: teacher.id,
      endTime: "10:00",
      room: "Room 10-A",
    },
    create: {
      tenantId: demoTenant.id,
      academicSessionId: currentSession.id,
      classSectionId: classSection.id,
      classSubjectId: classSubject.id,
      teacherId: teacher.id,
      weekday: "MONDAY",
      startTime: "09:00",
      endTime: "10:00",
      room: "Room 10-A",
    },
  });
  let homework = await prisma.homework.findFirst({
    where: { tenantId: demoTenant.id, title: "Algebra revision worksheet" },
  });
  const homeworkData = {
    academicSessionId: currentSession.id,
    classSectionId: classSection.id,
    classSubjectId: classSubject.id,
    teacherId: teacher.id,
    description: "Complete questions 1 to 10 and explain each calculation.",
    attachmentUrl: "https://example.com/demo/algebra-worksheet.pdf",
    homeworkDate: new Date("2026-07-14T00:00:00.000Z"),
    submissionDate: new Date("2026-07-20T00:00:00.000Z"),
    status: "PUBLISHED" as const,
  };
  homework = homework
    ? await prisma.homework.update({ where: { id: homework.id }, data: homeworkData })
    : await prisma.homework.create({
        data: {
          tenantId: demoTenant.id,
          title: "Algebra revision worksheet",
          ...homeworkData,
        },
      });
  await prisma.homeworkSubmission.upsert({
    where: {
      tenantId_homeworkId_studentEnrollmentId: {
        tenantId: demoTenant.id,
        homeworkId: homework.id,
        studentEnrollmentId: demoEnrollment.id,
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      homeworkId: homework.id,
      studentEnrollmentId: demoEnrollment.id,
      answerText: "Completed questions 1 to 10 with working.",
    },
  });
  await prisma.erpIntegrationSetting.upsert({
    where: {
      tenantId_category: {
        tenantId: demoTenant.id,
        category: "NOTIFICATION",
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      category: "NOTIFICATION",
      provider: "IN_APP",
      isEnabled: true,
      config: { attendanceAlerts: true, feeReminders: true, homeworkAlerts: true },
    },
  });
  await prisma.tenantPaymentMethod.upsert({
    where: {
      tenantId_code: { tenantId: demoTenant.id, code: "SCHOOL_BANK" },
    },
    update: { name: "School bank transfer", isActive: true },
    create: {
      tenantId: demoTenant.id,
      code: "SCHOOL_BANK",
      name: "School bank transfer",
      instructions: "Use the student admission number as the payment reference.",
    },
  });
  for (const moduleKey of [
    "dashboard",
    "students",
    "academics",
    "timetable",
    "attendance",
    "fees",
    "examinations",
    "homework",
    "hr",
    "documents",
    "reports",
  ]) {
    await prisma.tenantModuleSetting.upsert({
      where: { tenantId_moduleKey: { tenantId: demoTenant.id, moduleKey } },
      update: {},
      create: { tenantId: demoTenant.id, moduleKey },
    });
  }
  await prisma.tenantLanguage.upsert({
    where: { tenantId_code: { tenantId: demoTenant.id, code: "en" } },
    update: { name: "English", isEnabled: true, isDefault: true },
    create: {
      tenantId: demoTenant.id,
      code: "en",
      name: "English",
      isEnabled: true,
      isDefault: true,
    },
  });
  await prisma.customField.upsert({
    where: {
      tenantId_target_key: {
        tenantId: demoTenant.id,
        target: "STUDENT",
        key: "transport_route",
      },
    },
    update: { label: "Transport route", isActive: true },
    create: {
      tenantId: demoTenant.id,
      target: "STUDENT",
      key: "transport_route",
      label: "Transport route",
      type: "TEXT",
    },
  });
  await prisma.systemFieldSetting.upsert({
    where: {
      tenantId_target_fieldKey: {
        tenantId: demoTenant.id,
        target: "STUDENT",
        fieldKey: "bloodGroup",
      },
    },
    update: { label: "Blood group", isEnabled: true },
    create: {
      tenantId: demoTenant.id,
      target: "STUDENT",
      fieldKey: "bloodGroup",
      label: "Blood group",
      isEnabled: true,
    },
  });
  await prisma.shortcutKeySetting.upsert({
    where: {
      tenantId_actionKey: {
        tenantId: demoTenant.id,
        actionKey: "add_student",
      },
    },
    update: { shortcut: "Ctrl+Shift+S" },
    create: {
      tenantId: demoTenant.id,
      actionKey: "add_student",
      shortcut: "Ctrl+Shift+S",
    },
  });
  await prisma.studentProfileRight.upsert({
    where: {
      tenantId_fieldKey: {
        tenantId: demoTenant.id,
        fieldKey: "mobile",
      },
    },
    update: { studentVisible: true, studentEditable: true },
    create: {
      tenantId: demoTenant.id,
      fieldKey: "mobile",
      studentVisible: true,
      parentVisible: true,
      studentEditable: true,
      parentEditable: true,
    },
  });
  const existingHoliday = await prisma.holiday.findFirst({
    where: { tenantId: demoTenant.id, title: "Independence Day" },
  });
  if (!existingHoliday) {
    await prisma.holiday.create({
      data: {
        tenantId: demoTenant.id,
        academicSessionId: currentSession.id,
        title: "Independence Day",
        startDate: new Date("2026-08-15T00:00:00.000Z"),
        endDate: new Date("2026-08-15T00:00:00.000Z"),
      },
    });
  }
  let studentFolder = await prisma.studentDocumentFolder.findFirst({
    where: { tenantId: demoTenant.id, parentId: null, name: "Admission Documents" },
  });
  studentFolder ??= await prisma.studentDocumentFolder.create({
    data: { tenantId: demoTenant.id, name: "Admission Documents" },
  });
  const existingStudentDocument = await prisma.studentDocument.findFirst({
    where: {
      tenantId: demoTenant.id,
      studentId: demoStudent.id,
      name: "Birth certificate",
    },
  });
  if (!existingStudentDocument) {
    await prisma.studentDocument.create({
      data: {
        tenantId: demoTenant.id,
        studentId: demoStudent.id,
        folderId: studentFolder.id,
        name: "Birth certificate",
        fileUrl: "https://example.com/demo/birth-certificate.pdf",
        mimeType: "application/pdf",
        uploadedById: demoAdmin.id,
      },
    });
  }
  const completionAudit = await prisma.auditLog.findFirst({
    where: { tenantId: demoTenant.id, action: "CMS_COMPLETION_SEEDED" },
  });
  if (!completionAudit) {
    await prisma.auditLog.create({
      data: {
        tenantId: demoTenant.id,
        userId: demoAdmin.id,
        action: "CMS_COMPLETION_SEEDED",
        entityType: "SYSTEM",
        metadata: {
          modules: ["timetable", "homework", "erp-settings", "holidays", "student-documents"],
        },
      },
    });
  }

  console.log("Seeded complete CMS demonstration data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
