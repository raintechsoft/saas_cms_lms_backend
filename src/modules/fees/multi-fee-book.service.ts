import {
  EnrollmentStatus,
  FeeInvoiceStatus,
  MultiFeeBookHeadFrequency,
  MultiFeeBookTarget,
  MultiFeeBookType,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function formatClassRange(classes: Array<{ name: string; sortOrder: number }>) {
  if (!classes.length) return "—";
  const sorted = [...classes].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  if (sorted.length === 1) return sorted[0].name;
  return `${sorted[0].name} - ${sorted[sorted.length - 1].name}`;
}

const bookInclude = {
  academicSession: { select: { id: true, name: true, isCurrent: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  classes: {
    include: {
      academicClass: { select: { id: true, name: true, sortOrder: true } },
    },
  },
  heads: {
    include: {
      feeType: {
        select: {
          id: true,
          name: true,
          kind: true,
          defaultAmount: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
};

async function studentCountForClasses(
  tenantId: string,
  academicSessionId: string,
  classIds: string[],
) {
  if (!classIds.length) return 0;
  return prisma.studentEnrollment.count({
    where: tenantScope(tenantId, {
      academicSessionId,
      status: EnrollmentStatus.ACTIVE,
      classSection: { classId: { in: classIds } },
    }),
  });
}

function mapBook(
  book: {
    id: string;
    name: string;
    description: string | null;
    type: MultiFeeBookType;
    target: MultiFeeBookTarget;
    isActive: boolean;
    createdAt: Date;
    academicSession: { id: string; name: string; isCurrent: boolean };
    createdBy: { id: string; firstName: string; lastName: string } | null;
    classes: Array<{
      academicClass: { id: string; name: string; sortOrder: number };
    }>;
    heads: Array<{
      id: string;
      amount: Prisma.Decimal;
      frequency: MultiFeeBookHeadFrequency;
      sortOrder: number;
      feeType: {
        id: string;
        name: string;
        kind: string;
        defaultAmount: Prisma.Decimal;
      };
    }>;
  },
  studentCount: number,
) {
  const classes = book.classes.map((row) => row.academicClass);
  return {
    id: book.id,
    name: book.name,
    description: book.description,
    type: book.type,
    target: book.target,
    isActive: book.isActive,
    createdAt: book.createdAt,
    academicSession: book.academicSession,
    createdByName: book.createdBy
      ? `${book.createdBy.firstName} ${book.createdBy.lastName}`.trim()
      : "—",
    classesLabel: formatClassRange(classes),
    classes,
    studentCount,
    headCount: book.heads.length,
    heads: book.heads.map((head) => ({
      id: head.id,
      feeTypeId: head.feeType.id,
      headName: head.feeType.name,
      headType: head.feeType.kind === "ONE_TIME" ? "One Time" : "Fixed",
      amount: money(head.amount),
      frequency: head.frequency,
      sortOrder: head.sortOrder,
    })),
  };
}

async function loadBook(tenantId: string, id: string) {
  const book = await prisma.multiFeeBook.findFirst({
    where: tenantScope(tenantId, { id }),
    include: bookInclude,
  });
  if (!book) throw new AppError(404, "Fee book not found", "FEE_BOOK_NOT_FOUND");
  const studentCount = await studentCountForClasses(
    tenantId,
    book.academicSessionId,
    book.classes.map((row) => row.classId),
  );
  return mapBook(book, studentCount);
}

export async function getMultiFeeBookSetup(tenantId: string) {
  const currentSession = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { isCurrent: true }),
  });

  const [books, classes, feeTypes, sessions, collectionAgg, outstandingInvoices] =
    await Promise.all([
      prisma.multiFeeBook.findMany({
        where: tenantScope(tenantId, {}),
        include: bookInclude,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
      prisma.academicClass.findMany({
        where: tenantScope(tenantId, {}),
        select: { id: true, name: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.feeType.findMany({
        where: tenantScope(tenantId, { isActive: true }),
        select: { id: true, name: true, kind: true, defaultAmount: true },
        orderBy: { name: "asc" },
      }),
      prisma.academicSession.findMany({
        where: tenantScope(tenantId, {}),
        select: { id: true, name: true, isCurrent: true },
        orderBy: { startDate: "desc" },
      }),
      currentSession
        ? prisma.feePayment.aggregate({
            where: tenantScope(tenantId, {
              academicSessionId: currentSession.id,
              status: PaymentStatus.COLLECTED,
            }),
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
      currentSession
        ? prisma.feeInvoice.findMany({
            where: tenantScope(tenantId, {
              academicSessionId: currentSession.id,
              status: { in: [FeeInvoiceStatus.DUE, FeeInvoiceStatus.OVERDUE] },
            }),
            select: { total: true, paidAmount: true },
          })
        : Promise.resolve([]),
    ]);

  const outstanding = outstandingInvoices.reduce(
    (sum, invoice) => sum + Math.max(0, money(invoice.total) - money(invoice.paidAmount)),
    0,
  );

  const mappedBooks = await Promise.all(
    books.map(async (book) => {
      const studentCount = await studentCountForClasses(
        tenantId,
        book.academicSessionId,
        book.classes.map((row) => row.classId),
      );
      return mapBook(book, studentCount);
    }),
  );

  const assignedStudents = mappedBooks
    .filter((book) => book.isActive)
    .reduce((sum, book) => sum + book.studentCount, 0);

  return {
    currentSession,
    sessions,
    classes,
    feeTypes: feeTypes.map((item) => ({
      ...item,
      defaultAmount: money(item.defaultAmount),
    })),
    books: mappedBooks,
    stats: {
      totalFeeBooks: mappedBooks.length,
      activeFeeBooks: mappedBooks.filter((book) => book.isActive).length,
      assignedStudents,
      totalCollection: money(collectionAgg._sum.amount),
      outstanding,
      sessionName: currentSession?.name ?? null,
    },
  };
}

async function syncClasses(tenantId: string, feeBookId: string, classIds: string[]) {
  const unique = [...new Set(classIds)];
  if (unique.length) {
    const count = await prisma.academicClass.count({
      where: tenantScope(tenantId, { id: { in: unique } }),
    });
    if (count !== unique.length) {
      throw new AppError(400, "One or more classes are invalid", "INVALID_CLASS");
    }
  }
  await prisma.$transaction([
    prisma.multiFeeBookClass.deleteMany({
      where: tenantScope(tenantId, { feeBookId }),
    }),
    ...(unique.length
      ? [
          prisma.multiFeeBookClass.createMany({
            data: unique.map((classId) => ({ tenantId, feeBookId, classId })),
          }),
        ]
      : []),
  ]);
}

async function syncHeads(
  tenantId: string,
  feeBookId: string,
  heads: Array<{
    feeTypeId: string;
    amount: number;
    frequency: MultiFeeBookHeadFrequency;
  }>,
) {
  const uniqueTypeIds = [...new Set(heads.map((h) => h.feeTypeId))];
  if (uniqueTypeIds.length !== heads.length) {
    throw new AppError(400, "Duplicate fee heads are not allowed in a book", "DUPLICATE_HEAD");
  }
  if (uniqueTypeIds.length) {
    const count = await prisma.feeType.count({
      where: tenantScope(tenantId, { id: { in: uniqueTypeIds } }),
    });
    if (count !== uniqueTypeIds.length) {
      throw new AppError(400, "One or more fee heads are invalid", "INVALID_FEE_TYPE");
    }
  }
  await prisma.$transaction([
    prisma.multiFeeBookHead.deleteMany({
      where: tenantScope(tenantId, { feeBookId }),
    }),
    ...(heads.length
      ? [
          prisma.multiFeeBookHead.createMany({
            data: heads.map((head, index) => ({
              tenantId,
              feeBookId,
              feeTypeId: head.feeTypeId,
              amount: head.amount,
              frequency: head.frequency,
              sortOrder: index + 1,
            })),
          }),
        ]
      : []),
  ]);
}

export async function createMultiFeeBook(
  tenantId: string,
  userId: string | undefined,
  input: {
    name: string;
    description?: string | null;
    academicSessionId: string;
    type?: MultiFeeBookType;
    target?: MultiFeeBookTarget;
    isActive?: boolean;
    classIds?: string[];
    heads?: Array<{
      feeTypeId: string;
      amount: number;
      frequency: MultiFeeBookHeadFrequency;
    }>;
  },
) {
  const session = await prisma.academicSession.findFirst({
    where: tenantScope(tenantId, { id: input.academicSessionId }),
    select: { id: true },
  });
  if (!session) throw new AppError(400, "Academic session is invalid", "INVALID_SESSION");

  const name = input.name.trim();
  const exists = await prisma.multiFeeBook.findFirst({
    where: tenantScope(tenantId, {
      academicSessionId: input.academicSessionId,
      name,
    }),
    select: { id: true },
  });
  if (exists) throw new AppError(409, `Fee book "${name}" already exists`, "FEE_BOOK_EXISTS");

  const book = await prisma.multiFeeBook.create({
    data: {
      tenantId,
      academicSessionId: input.academicSessionId,
      name,
      description: input.description?.trim() || null,
      type: input.type ?? MultiFeeBookType.GENERAL,
      target: input.target ?? MultiFeeBookTarget.CLASSES,
      isActive: input.isActive ?? true,
      createdById: userId ?? null,
    },
  });

  if (input.classIds) await syncClasses(tenantId, book.id, input.classIds);
  if (input.heads) await syncHeads(tenantId, book.id, input.heads);

  return loadBook(tenantId, book.id);
}

export async function updateMultiFeeBook(
  tenantId: string,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    academicSessionId?: string;
    type?: MultiFeeBookType;
    target?: MultiFeeBookTarget;
    isActive?: boolean;
    classIds?: string[];
    heads?: Array<{
      feeTypeId: string;
      amount: number;
      frequency: MultiFeeBookHeadFrequency;
    }>;
  },
) {
  const existing = await prisma.multiFeeBook.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!existing) throw new AppError(404, "Fee book not found", "FEE_BOOK_NOT_FOUND");

  if (input.academicSessionId) {
    const session = await prisma.academicSession.findFirst({
      where: tenantScope(tenantId, { id: input.academicSessionId }),
      select: { id: true },
    });
    if (!session) throw new AppError(400, "Academic session is invalid", "INVALID_SESSION");
  }

  if (input.name) {
    const clash = await prisma.multiFeeBook.findFirst({
      where: tenantScope(tenantId, {
        academicSessionId: input.academicSessionId ?? existing.academicSessionId,
        name: input.name.trim(),
        id: { not: id },
      }),
      select: { id: true },
    });
    if (clash) throw new AppError(409, `Fee book "${input.name.trim()}" already exists`, "FEE_BOOK_EXISTS");
  }

  await prisma.multiFeeBook.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      academicSessionId: input.academicSessionId,
      type: input.type,
      target: input.target,
      isActive: input.isActive,
    },
  });

  if (input.classIds) await syncClasses(tenantId, id, input.classIds);
  if (input.heads) await syncHeads(tenantId, id, input.heads);

  return loadBook(tenantId, id);
}

export async function copyMultiFeeBook(
  tenantId: string,
  userId: string | undefined,
  id: string,
) {
  const source = await prisma.multiFeeBook.findFirst({
    where: tenantScope(tenantId, { id }),
    include: {
      classes: true,
      heads: true,
    },
  });
  if (!source) throw new AppError(404, "Fee book not found", "FEE_BOOK_NOT_FOUND");

  let copyName = `${source.name} (Copy)`;
  let n = 2;
  while (
    await prisma.multiFeeBook.findFirst({
      where: tenantScope(tenantId, {
        academicSessionId: source.academicSessionId,
        name: copyName,
      }),
      select: { id: true },
    })
  ) {
    copyName = `${source.name} (Copy ${n})`;
    n += 1;
  }

  return createMultiFeeBook(tenantId, userId, {
    name: copyName,
    description: source.description,
    academicSessionId: source.academicSessionId,
    type: source.type,
    target: source.target,
    isActive: source.isActive,
    classIds: source.classes.map((row) => row.classId),
    heads: source.heads.map((head) => ({
      feeTypeId: head.feeTypeId,
      amount: money(head.amount),
      frequency: head.frequency,
    })),
  });
}

export async function deleteMultiFeeBook(tenantId: string, id: string) {
  const existing = await prisma.multiFeeBook.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Fee book not found", "FEE_BOOK_NOT_FOUND");
  await prisma.multiFeeBook.delete({ where: { id } });
  return { ok: true };
}
