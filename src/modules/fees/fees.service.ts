import {
  DiscountType,
  EnrollmentStatus,
  FeeAssignmentStatus,
  FeeFineType,
  PaymentStatus,
  Prisma,
  type PaymentMode,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

interface FeeMasterInput {
  academicSessionId: string;
  classSectionId?: string | null;
  feeGroupId: string;
  feeTypeId: string;
  amount: number;
  dueDate: Date;
  fineType: FeeFineType;
  fineValue: number;
  graceDays: number;
  isCustom?: boolean;
}

interface PaymentItemInput {
  assignmentId: string;
  amount: number;
}

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function calculateDiscount(
  type: DiscountType | undefined,
  value: Prisma.Decimal | undefined,
  base: number,
) {
  if (!type || !value) return 0;
  const discount = type === DiscountType.PERCENTAGE
    ? base * money(value) / 100
    : money(value);
  return Math.min(base, Math.max(0, discount));
}

function calculateFine(
  fineType: FeeFineType,
  fineValue: Prisma.Decimal,
  base: number,
  dueDate: Date,
  graceDays: number,
  asOf: Date,
) {
  const effectiveDue = new Date(dueDate);
  effectiveDue.setUTCDate(effectiveDue.getUTCDate() + graceDays);
  if (fineType === FeeFineType.NONE || asOf <= effectiveDue) return 0;
  return fineType === FeeFineType.PERCENTAGE
    ? base * money(fineValue) / 100
    : money(fineValue);
}

const assignmentInclude = {
  feeMaster: {
    include: { feeType: true, feeGroup: true, academicSession: true },
  },
  discount: true,
  paymentItems: {
    where: { payment: { status: PaymentStatus.COLLECTED } },
    include: { payment: true },
  },
} satisfies Prisma.StudentFeeAssignmentInclude;

function toDue(assignment: Prisma.StudentFeeAssignmentGetPayload<{
  include: typeof assignmentInclude;
}>, asOf: Date) {
  const base = money(assignment.customAmount ?? assignment.feeMaster.amount)
    + money(assignment.carryForwardAmount);
  const discount = calculateDiscount(
    assignment.discount?.type,
    assignment.discount?.value,
    base,
  );
  const fine = calculateFine(
    assignment.feeMaster.fineType,
    assignment.feeMaster.fineValue,
    base,
    assignment.feeMaster.dueDate,
    assignment.feeMaster.graceDays,
    asOf,
  );
  const paid = assignment.paymentItems.reduce(
    (sum, item) => sum + money(item.paidAmount),
    0,
  );
  const balance = Math.max(0, base - discount + fine - paid);
  return { ...assignment, totals: { base, discount, fine, paid, balance } };
}

async function ensureDefaultReceiptBook(tenantId: string) {
  const existing = await prisma.feeReceiptBook.findFirst({
    where: tenantScope(tenantId, {}),
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  if (existing) {
    if (!existing.isDefault) {
      return prisma.feeReceiptBook.update({
        where: { id: existing.id },
        data: { isDefault: true },
      });
    }
    return existing;
  }
  return prisma.feeReceiptBook.create({
    data: {
      tenantId,
      name: "Main",
      prefix: "RCPT-",
      isDefault: true,
    },
  });
}

export async function getFeeSetup(tenantId: string) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });
  await ensureDefaultReceiptBook(tenantId);
  const [types, groups, discounts, receiptBooks, classSections, masters, setting] =
    await Promise.all([
      prisma.feeType.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: { name: "asc" },
      }),
      prisma.feeGroup.findMany({
        where: tenantScope(tenantId, {}),
        include: { items: { include: { feeType: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.feeDiscount.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: { name: "asc" },
      }),
      prisma.feeReceiptBook.findMany({
        where: tenantScope(tenantId, {}),
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      }),
      currentSession
        ? prisma.classSection.findMany({
            where: tenantScope(tenantId, { academicSessionId: currentSession.id }),
            include: {
              academicClass: true,
              section: true,
              enrollments: {
                where: { status: "ACTIVE" },
                include: {
                  student: {
                    select: {
                      id: true,
                      admissionNumber: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
            orderBy: [
              { academicClass: { sortOrder: "asc" } },
              { section: { name: "asc" } },
            ],
          })
        : Promise.resolve([]),
      currentSession
        ? prisma.feeMaster.findMany({
            where: tenantScope(tenantId, { academicSessionId: currentSession.id }),
            include: {
              feeType: true,
              feeGroup: true,
              classSection: { include: { academicClass: true, section: true } },
              _count: { select: { assignments: true } },
            },
            orderBy: { dueDate: "asc" },
          })
        : Promise.resolve([]),
      prisma.tenantFeeSetting.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      }),
    ]);
  return {
    currentSession,
    types,
    groups,
    discounts,
    receiptBooks,
    classSections,
    masters,
    setting,
  };
}

export function createFeeType(
  tenantId: string,
  input: { name: string; code?: string | null; description?: string | null },
) {
  return prisma.feeType.create({ data: { tenantId, ...input } });
}

export async function createFeeGroup(
  tenantId: string,
  input: { name: string; description?: string | null; feeTypeIds: string[] },
) {
  const count = await prisma.feeType.count({
    where: tenantScope(tenantId, { id: { in: input.feeTypeIds } }),
  });
  if (count !== new Set(input.feeTypeIds).size) {
    throw new AppError(400, "One or more fee types are invalid", "INVALID_FEE_TYPE");
  }
  return prisma.feeGroup.create({
    data: {
      tenantId,
      name: input.name,
      description: input.description,
      items: {
        create: [...new Set(input.feeTypeIds)].map((feeTypeId) => ({ feeTypeId })),
      },
    },
    include: { items: { include: { feeType: true } } },
  });
}

export function createFeeDiscount(
  tenantId: string,
  input: {
    name: string;
    code?: string | null;
    category?: string | null;
    description?: string | null;
    type: DiscountType;
    value: number;
  },
) {
  if (input.type === DiscountType.PERCENTAGE && input.value > 100) {
    throw new AppError(400, "Percentage discount cannot exceed 100", "INVALID_DISCOUNT");
  }
  return prisma.feeDiscount.create({
    data: {
      tenantId,
      name: input.name,
      code: input.code?.trim() || null,
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      type: input.type,
      value: input.value,
    },
  });
}

export async function createReceiptBook(
  tenantId: string,
  input: { name: string; prefix: string; isDefault: boolean },
) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.feeReceiptBook.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.feeReceiptBook.create({ data: { tenantId, ...input } });
  });
}

export async function createFeeMaster(tenantId: string, input: FeeMasterInput) {
  if (input.fineType === FeeFineType.PERCENTAGE && input.fineValue > 100) {
    throw new AppError(400, "Percentage fine cannot exceed 100", "INVALID_FINE");
  }
  const [session, group, type, classSection, groupItem] = await Promise.all([
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: input.academicSessionId }),
    }),
    prisma.feeGroup.findFirst({ where: tenantScope(tenantId, { id: input.feeGroupId }) }),
    prisma.feeType.findFirst({ where: tenantScope(tenantId, { id: input.feeTypeId }) }),
    input.classSectionId
      ? prisma.classSection.findFirst({
          where: tenantScope(tenantId, {
            id: input.classSectionId,
            academicSessionId: input.academicSessionId,
          }),
        })
      : Promise.resolve(true),
    prisma.feeGroupItem.findUnique({
      where: {
        feeGroupId_feeTypeId: {
          feeGroupId: input.feeGroupId,
          feeTypeId: input.feeTypeId,
        },
      },
    }),
  ]);
  if (!session || !group || !type || !classSection || !groupItem) {
    throw new AppError(400, "Fee master references are invalid", "INVALID_FEE_MASTER");
  }
  if (!input.classSectionId && !input.isCustom) {
    throw new AppError(400, "A class section is required", "CLASS_SECTION_REQUIRED");
  }
  return prisma.feeMaster.create({ data: { tenantId, ...input } });
}

async function requireFeeType(tenantId: string, id: string) {
  const row = await prisma.feeType.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!row) throw new AppError(404, "Fee type not found", "FEE_TYPE_NOT_FOUND");
  return row;
}

async function requireFeeGroup(tenantId: string, id: string) {
  const row = await prisma.feeGroup.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { items: { include: { feeType: true } }, _count: { select: { feeMasters: true } } },
  });
  if (!row) throw new AppError(404, "Fee group not found", "FEE_GROUP_NOT_FOUND");
  return row;
}

async function requireFeeDiscount(tenantId: string, id: string) {
  const row = await prisma.feeDiscount.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!row) throw new AppError(404, "Fee discount not found", "FEE_DISCOUNT_NOT_FOUND");
  return row;
}

async function requireReceiptBook(tenantId: string, id: string) {
  const row = await prisma.feeReceiptBook.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { _count: { select: { payments: true } } },
  });
  if (!row) throw new AppError(404, "Receipt book not found", "RECEIPT_BOOK_NOT_FOUND");
  return row;
}

async function requireFeeMaster(tenantId: string, id: string) {
  const row = await prisma.feeMaster.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      feeType: true,
      feeGroup: true,
      classSection: { include: { academicClass: true, section: true } },
      _count: { select: { assignments: true } },
    },
  });
  if (!row) throw new AppError(404, "Fee master not found", "FEE_MASTER_NOT_FOUND");
  return row;
}

export async function updateFeeType(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    code?: string | null;
    description?: string | null;
    isActive?: boolean;
  },
) {
  await requireFeeType(tenantId, id);
  return prisma.feeType.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code === undefined ? undefined : input.code,
      description: input.description === undefined ? undefined : input.description,
      isActive: input.isActive,
    },
  });
}

export async function deleteFeeType(tenantId: string, id: string) {
  const row = await prisma.feeType.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      _count: { select: { feeMasters: true, groupItems: true } },
    },
  });
  if (!row) throw new AppError(404, "Fee type not found", "FEE_TYPE_NOT_FOUND");
  if (row._count.feeMasters > 0 || row._count.groupItems > 0) {
    // Soft-disable when referenced so history stays intact.
    return prisma.feeType.update({
      where: { id },
      data: { isActive: false },
    });
  }
  await prisma.feeType.delete({ where: { id } });
  return { id, deleted: true as const };
}

export async function updateFeeGroup(
  tenantId: string,
  id: string,
  input: { name?: string; description?: string | null; feeTypeIds?: string[] },
) {
  await requireFeeGroup(tenantId, id);
  if (input.feeTypeIds) {
    const count = await prisma.feeType.count({
      where: tenantScope(tenantId, { id: { in: input.feeTypeIds } }),
    });
    if (count !== new Set(input.feeTypeIds).size) {
      throw new AppError(400, "One or more fee types are invalid", "INVALID_FEE_TYPE");
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.feeTypeIds) {
      await tx.feeGroupItem.deleteMany({ where: { feeGroupId: id } });
      await tx.feeGroupItem.createMany({
        data: [...new Set(input.feeTypeIds)].map((feeTypeId) => ({ feeGroupId: id, feeTypeId })),
      });
    }
    return tx.feeGroup.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
      },
      include: { items: { include: { feeType: true } } },
    });
  });
}

export async function deleteFeeGroup(tenantId: string, id: string) {
  const row = await requireFeeGroup(tenantId, id);
  if (row._count.feeMasters > 0) {
    throw new AppError(409, "Fee group is used by fee masters", "FEE_GROUP_IN_USE");
  }
  await prisma.feeGroup.delete({ where: { id } });
}

export async function updateFeeDiscount(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    code?: string | null;
    category?: string | null;
    description?: string | null;
    type?: DiscountType;
    value?: number;
    isActive?: boolean;
  },
) {
  await requireFeeDiscount(tenantId, id);
  const type = input.type;
  const value = input.value;
  if (type === DiscountType.PERCENTAGE && value !== undefined && value > 100) {
    throw new AppError(400, "Percentage discount cannot exceed 100", "INVALID_DISCOUNT");
  }
  return prisma.feeDiscount.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code === undefined ? undefined : input.code?.trim() || null,
      category: input.category === undefined ? undefined : input.category?.trim() || null,
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      type,
      value,
      isActive: input.isActive,
    },
  });
}

export async function deleteFeeDiscount(tenantId: string, id: string) {
  const row = await prisma.feeDiscount.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { _count: { select: { assignments: true } } },
  });
  if (!row) throw new AppError(404, "Fee discount not found", "FEE_DISCOUNT_NOT_FOUND");
  if (row._count.assignments > 0) {
    return prisma.feeDiscount.update({
      where: { id },
      data: { isActive: false },
    });
  }
  await prisma.feeDiscount.delete({ where: { id } });
  return { id, deleted: true as const };
}

export async function updateReceiptBook(
  tenantId: string,
  id: string,
  input: { name?: string; prefix?: string; isDefault?: boolean },
) {
  await requireReceiptBook(tenantId, id);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.feeReceiptBook.updateMany({
        where: { tenantId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    return tx.feeReceiptBook.update({
      where: { id },
      data: {
        name: input.name,
        prefix: input.prefix,
        isDefault: input.isDefault,
      },
    });
  });
}

export async function deleteReceiptBook(tenantId: string, id: string) {
  const row = await requireReceiptBook(tenantId, id);
  if (row._count.payments > 0) {
    throw new AppError(409, "Receipt book has payments and cannot be deleted", "RECEIPT_BOOK_IN_USE");
  }
  if (row.isDefault) {
    throw new AppError(409, "Set another default receipt book before deleting this one", "DEFAULT_RECEIPT_BOOK");
  }
  await prisma.feeReceiptBook.delete({ where: { id } });
}

export async function updateFeeMaster(
  tenantId: string,
  id: string,
  input: Partial<FeeMasterInput>,
) {
  const existing = await requireFeeMaster(tenantId, id);
  const next = {
    academicSessionId: input.academicSessionId ?? existing.academicSessionId,
    classSectionId:
      input.classSectionId !== undefined ? input.classSectionId : existing.classSectionId,
    feeGroupId: input.feeGroupId ?? existing.feeGroupId,
    feeTypeId: input.feeTypeId ?? existing.feeTypeId,
    amount: input.amount ?? Number(existing.amount),
    dueDate: input.dueDate ?? existing.dueDate,
    fineType: input.fineType ?? existing.fineType,
    fineValue: input.fineValue ?? Number(existing.fineValue),
    graceDays: input.graceDays ?? existing.graceDays,
    isCustom: input.isCustom ?? existing.isCustom,
  };

  if (next.fineType === FeeFineType.PERCENTAGE && next.fineValue > 100) {
    throw new AppError(400, "Percentage fine cannot exceed 100", "INVALID_FINE");
  }

  const [session, group, type, classSection, groupItem] = await Promise.all([
    prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: next.academicSessionId }),
    }),
    prisma.feeGroup.findFirst({ where: tenantScope(tenantId, { id: next.feeGroupId }) }),
    prisma.feeType.findFirst({ where: tenantScope(tenantId, { id: next.feeTypeId }) }),
    next.classSectionId
      ? prisma.classSection.findFirst({
          where: tenantScope(tenantId, {
            id: next.classSectionId,
            academicSessionId: next.academicSessionId,
          }),
        })
      : Promise.resolve(true),
    prisma.feeGroupItem.findUnique({
      where: {
        feeGroupId_feeTypeId: {
          feeGroupId: next.feeGroupId,
          feeTypeId: next.feeTypeId,
        },
      },
    }),
  ]);
  if (!session || !group || !type || !classSection || !groupItem) {
    throw new AppError(400, "Fee master references are invalid", "INVALID_FEE_MASTER");
  }
  if (!next.classSectionId && !next.isCustom) {
    throw new AppError(400, "A class section is required", "CLASS_SECTION_REQUIRED");
  }

  return prisma.feeMaster.update({
    where: { id },
    data: next,
    include: {
      feeType: true,
      feeGroup: true,
      classSection: { include: { academicClass: true, section: true } },
      _count: { select: { assignments: true } },
    },
  });
}

export async function deleteFeeMaster(tenantId: string, id: string) {
  const row = await requireFeeMaster(tenantId, id);
  const paidAssignments = await prisma.studentFeeAssignment.count({
    where: tenantScope(tenantId, {
      feeMasterId: id,
      paymentItems: { some: {} },
    }),
  });
  if (paidAssignments > 0) {
    throw new AppError(409, "Fee master has collected payments and cannot be deleted", "FEE_MASTER_IN_USE");
  }
  // Assignments without payments are removed via cascade from FeeMaster.
  if (row._count.assignments > 0) {
    await prisma.studentFeeAssignment.deleteMany({
      where: tenantScope(tenantId, { feeMasterId: id, paymentItems: { none: {} } }),
    });
  }
  await prisma.feeMaster.delete({ where: { id } });
}

export async function assignFeeMaster(
  tenantId: string,
  masterId: string,
  enrollmentIds?: string[],
) {
  const master = await prisma.feeMaster.findFirst({
    where: tenantScope(tenantId, { id: masterId }),
  });
  if (!master) throw new AppError(404, "Fee master not found", "FEE_MASTER_NOT_FOUND");
  const enrollments = await prisma.studentEnrollment.findMany({
    where: tenantScope(tenantId, {
      academicSessionId: master.academicSessionId,
      status: EnrollmentStatus.ACTIVE,
      ...(enrollmentIds?.length
        ? { id: { in: enrollmentIds } }
        : master.classSectionId
          ? { classSectionId: master.classSectionId }
          : { id: { in: [] } }),
    }),
    select: { id: true },
  });
  if (enrollmentIds && enrollments.length !== new Set(enrollmentIds).size) {
    throw new AppError(400, "One or more enrolments are invalid", "INVALID_ENROLLMENT");
  }
  if (!enrollments.length) {
    throw new AppError(400, "No eligible students found", "NO_ELIGIBLE_STUDENTS");
  }
  const result = await prisma.studentFeeAssignment.createMany({
    data: enrollments.map(({ id }) => ({
      tenantId,
      studentEnrollmentId: id,
      feeMasterId: master.id,
    })),
    skipDuplicates: true,
  });
  return { assigned: result.count, eligible: enrollments.length };
}

export async function updateAssignmentDiscount(
  tenantId: string,
  assignmentId: string,
  discountId: string | null,
) {
  const [assignment, discount] = await Promise.all([
    prisma.studentFeeAssignment.findFirst({
      where: tenantScope(tenantId, { id: assignmentId }),
    }),
    discountId
      ? prisma.feeDiscount.findFirst({
          where: tenantScope(tenantId, { id: discountId, isActive: true }),
        })
      : Promise.resolve(true),
  ]);
  if (!assignment || !discount) {
    throw new AppError(400, "Assignment or discount is invalid", "INVALID_DISCOUNT_ASSIGNMENT");
  }
  return prisma.studentFeeAssignment.update({
    where: { id: assignmentId },
    data: { discountId },
  });
}

export async function listStudentFees(
  tenantId: string,
  studentId: string,
  sessionId?: string,
  asOf = new Date(),
) {
  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: studentId }),
    include: {
      enrollments: {
        where: sessionId ? { academicSessionId: sessionId } : { academicSession: { isCurrent: true } },
        include: {
          classSection: { include: { academicClass: true, section: true } },
          feeAssignments: {
            where: { status: FeeAssignmentStatus.ACTIVE },
            include: assignmentInclude,
          },
        },
      },
    },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");
  const assignments = student.enrollments.flatMap((enrollment) =>
    enrollment.feeAssignments.map((assignment) => ({
      ...toDue(assignment, asOf),
      enrollment: {
        id: enrollment.id,
        classSection: enrollment.classSection,
      },
    })),
  );
  const totals = assignments.reduce(
    (sum, item) => ({
      base: sum.base + item.totals.base,
      discount: sum.discount + item.totals.discount,
      fine: sum.fine + item.totals.fine,
      paid: sum.paid + item.totals.paid,
      balance: sum.balance + item.totals.balance,
    }),
    { base: 0, discount: 0, fine: 0, paid: 0, balance: 0 },
  );
  return { student, assignments, totals };
}

async function getAssignmentDue(
  db: DbClient,
  tenantId: string,
  assignmentId: string,
  asOf: Date,
) {
  const assignment = await db.studentFeeAssignment.findFirst({
    where: tenantScope(tenantId, {
      id: assignmentId,
      status: FeeAssignmentStatus.ACTIVE,
    }),
    include: assignmentInclude,
  });
  if (!assignment) {
    throw new AppError(400, "Fee assignment is invalid", "INVALID_FEE_ASSIGNMENT");
  }
  return toDue(assignment, asOf);
}

export async function collectPayment(
  tenantId: string,
  userId: string,
  input: {
    studentId: string;
    academicSessionId: string;
    receiptBookId?: string;
    paymentDate: Date;
    paymentMode: PaymentMode;
    note?: string | null;
    items: PaymentItemInput[];
  },
) {
  return prisma.$transaction(
    async (tx) => {
      const [student, session, receiptBook] = await Promise.all([
        tx.student.findFirst({ where: tenantScope(tenantId, { id: input.studentId }) }),
        tx.academicSession.findFirst({
          where: tenantScope(tenantId, { id: input.academicSessionId }),
        }),
        tx.feeReceiptBook.findFirst({
          where: tenantScope(tenantId, input.receiptBookId
            ? { id: input.receiptBookId }
            : { isDefault: true }),
        }),
      ]);
      if (!student || !session || !receiptBook) {
        throw new AppError(400, "Payment references are invalid", "INVALID_PAYMENT");
      }

      const uniqueItems = new Map(input.items.map((item) => [item.assignmentId, item]));
      if (uniqueItems.size !== input.items.length) {
        throw new AppError(400, "Duplicate fee assignment in payment", "DUPLICATE_PAYMENT_ITEM");
      }
      const calculated = [];
      for (const item of input.items) {
        const due = await getAssignmentDue(tx, tenantId, item.assignmentId, input.paymentDate);
        if (
          due.studentEnrollmentId === undefined ||
          item.amount <= 0 ||
          item.amount > due.totals.balance + 0.001
        ) {
          throw new AppError(400, "Payment exceeds the outstanding balance", "INVALID_AMOUNT");
        }
        const enrollment = await tx.studentEnrollment.findFirst({
          where: tenantScope(tenantId, {
            id: due.studentEnrollmentId,
            studentId: input.studentId,
            academicSessionId: input.academicSessionId,
          }),
        });
        if (!enrollment) {
          throw new AppError(400, "Fee does not belong to this student/session", "PAYMENT_SCOPE");
        }
        calculated.push({ item, due });
      }

      const updatedBook = await tx.feeReceiptBook.update({
        where: { id: receiptBook.id },
        data: { nextNumber: { increment: 1 } },
      });
      const sequence = updatedBook.nextNumber - 1;
      const receiptNumber = `${updatedBook.prefix}${String(sequence).padStart(6, "0")}`;
      const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const amount = calculated.reduce((sum, { item }) => sum + item.amount, 0);

      return tx.feePayment.create({
        data: {
          tenantId,
          studentId: input.studentId,
          academicSessionId: input.academicSessionId,
          receiptBookId: receiptBook.id,
          receiptNumber,
          paymentId,
          paymentDate: input.paymentDate,
          paymentMode: input.paymentMode,
          amount,
          note: input.note,
          createdById: userId,
          items: {
            create: calculated.map(({ item, due }) => ({
              assignmentId: item.assignmentId,
              baseAmount: due.totals.base,
              discountAmount: due.totals.discount,
              fineAmount: due.totals.fine,
              paidAmount: item.amount,
            })),
          },
        },
        include: {
          student: true,
          academicSession: true,
          receiptBook: true,
          items: {
            include: {
              assignment: {
                include: { feeMaster: { include: { feeType: true, feeGroup: true } } },
              },
            },
          },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function searchPayments(tenantId: string, query?: string) {
  return prisma.feePayment.findMany({
    where: tenantScope(tenantId, query
      ? {
          OR: [
            { paymentId: { contains: query } },
            { receiptNumber: { contains: query } },
            { student: { admissionNumber: { contains: query } } },
            { student: { firstName: { contains: query } } },
          ],
        }
      : {}),
    include: {
      student: true,
      academicSession: true,
      createdBy: { select: { firstName: true, lastName: true } },
      items: {
        include: {
          assignment: {
            include: { feeMaster: { include: { feeType: true } } },
          },
        },
      },
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function revertPayment(
  tenantId: string,
  paymentId: string,
  reason: string,
) {
  const payment = await prisma.feePayment.findFirst({
    where: tenantScope(tenantId, { id: paymentId }),
  });
  if (!payment) throw new AppError(404, "Payment not found", "PAYMENT_NOT_FOUND");
  if (payment.status === PaymentStatus.REVERTED) {
    throw new AppError(409, "Payment is already reverted", "PAYMENT_REVERTED");
  }
  return prisma.feePayment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.REVERTED, revertedAt: new Date(), revertReason: reason },
  });
}

export async function getFeeSummary(
  tenantId: string,
  sessionId: string,
  asOf = new Date(),
) {
  const assignments = await prisma.studentFeeAssignment.findMany({
    where: tenantScope(tenantId, {
      status: FeeAssignmentStatus.ACTIVE,
      feeMaster: { academicSessionId: sessionId },
    }),
    include: {
      ...assignmentInclude,
      studentEnrollment: { include: { student: true } },
    },
  });
  const dues = assignments.map((assignment) => ({
    ...toDue(assignment, asOf),
    student: assignment.studentEnrollment.student,
  }));
  const totals = dues.reduce(
    (sum, item) => ({
      assigned: sum.assigned + item.totals.base,
      discounts: sum.discounts + item.totals.discount,
      fines: sum.fines + item.totals.fine,
      collected: sum.collected + item.totals.paid,
      due: sum.due + item.totals.balance,
    }),
    { assigned: 0, discounts: 0, fines: 0, collected: 0, due: 0 },
  );
  return { totals, dues };
}

export async function carryForwardPreviousDues(
  tenantId: string,
  input: {
    fromSessionId: string;
    targetEnrollmentId: string;
    dueDate: Date;
    asOf?: Date;
  },
) {
  const targetEnrollment = await prisma.studentEnrollment.findFirst({
    where: tenantScope(tenantId, { id: input.targetEnrollmentId }),
  });
  if (!targetEnrollment) {
    throw new AppError(400, "Target enrolment is invalid", "INVALID_ENROLLMENT");
  }
  const previousAssignments = await prisma.studentFeeAssignment.findMany({
    where: tenantScope(tenantId, {
      status: FeeAssignmentStatus.ACTIVE,
      studentEnrollment: {
        studentId: targetEnrollment.studentId,
        academicSessionId: input.fromSessionId,
      },
    }),
    include: assignmentInclude,
  });
  const amount = previousAssignments.reduce(
    (sum, assignment) => sum + toDue(assignment, input.asOf ?? new Date()).totals.balance,
    0,
  );
  if (amount <= 0) {
    throw new AppError(409, "No previous-session balance to carry forward", "NO_BALANCE_DUE");
  }

  return prisma.$transaction(async (tx) => {
    const feeType = await tx.feeType.upsert({
      where: { tenantId_name: { tenantId, name: "Previous Session Due" } },
      update: { isActive: true },
      create: {
        tenantId,
        name: "Previous Session Due",
        code: "PREV_DUE",
        description: "Outstanding balance carried from a previous academic session",
      },
    });
    const feeGroup = await tx.feeGroup.upsert({
      where: { tenantId_name: { tenantId, name: "Carry Forward" } },
      update: {},
      create: { tenantId, name: "Carry Forward" },
    });
    await tx.feeGroupItem.upsert({
      where: {
        feeGroupId_feeTypeId: { feeGroupId: feeGroup.id, feeTypeId: feeType.id },
      },
      update: {},
      create: { feeGroupId: feeGroup.id, feeTypeId: feeType.id },
    });
    const master = await tx.feeMaster.upsert({
      where: {
        tenantId_academicSessionId_classSectionId_feeGroupId_feeTypeId_dueDate: {
          tenantId,
          academicSessionId: targetEnrollment.academicSessionId,
          classSectionId: targetEnrollment.classSectionId,
          feeGroupId: feeGroup.id,
          feeTypeId: feeType.id,
          dueDate: input.dueDate,
        },
      },
      update: {},
      create: {
        tenantId,
        academicSessionId: targetEnrollment.academicSessionId,
        classSectionId: targetEnrollment.classSectionId,
        feeGroupId: feeGroup.id,
        feeTypeId: feeType.id,
        amount: 0,
        dueDate: input.dueDate,
        isCustom: true,
      },
    });
    const assignment = await tx.studentFeeAssignment.upsert({
      where: {
        tenantId_studentEnrollmentId_feeMasterId: {
          tenantId,
          studentEnrollmentId: targetEnrollment.id,
          feeMasterId: master.id,
        },
      },
      update: { carryForwardAmount: amount, status: FeeAssignmentStatus.ACTIVE },
      create: {
        tenantId,
        studentEnrollmentId: targetEnrollment.id,
        feeMasterId: master.id,
        carryForwardAmount: amount,
      },
    });
    return { amount, assignment };
  });
}
