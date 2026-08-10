import { LibraryLoanStatus, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const DEFAULT_LOAN_DAYS = 14;

export type LibraryCategoryInput = {
  name: string;
  parentId?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

export type LibraryBookInput = {
  title: string;
  categoryId?: string | null;
  author?: string | null;
  isbn?: string | null;
  accessionNo?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  totalCopies?: number;
  availableCopies?: number;
  location?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

function bookInclude() {
  return {
    category: { select: { id: true, name: true } },
    _count: { select: { loans: true } },
  } as const;
}

function loanInclude() {
  return {
    book: {
      select: {
        id: true,
        title: true,
        author: true,
        accessionNo: true,
        isbn: true,
      },
    },
    student: {
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
      },
    },
    issuedBy: { select: { id: true, firstName: true, lastName: true } },
    returnedBy: { select: { id: true, firstName: true, lastName: true } },
  } as const;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function listLibraryCategories(tenantId: string) {
  return prisma.libraryCategory.findMany({
    where: tenantScope(tenantId, {}),
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { books: true } } },
  });
}

export async function createLibraryCategory(tenantId: string, input: LibraryCategoryInput) {
  if (input.parentId) {
    const parent = await prisma.libraryCategory.findFirst({
      where: tenantScope(tenantId, { id: input.parentId }),
      select: { id: true },
    });
    if (!parent) throw new AppError(400, "Parent category is invalid", "LIBRARY_PARENT_INVALID");
  }
  return prisma.libraryCategory.create({
    data: {
      tenantId,
      parentId: input.parentId ?? null,
      name: input.name.trim(),
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: { _count: { select: { books: true } } },
  });
}

export async function updateLibraryCategory(
  tenantId: string,
  id: string,
  input: Partial<LibraryCategoryInput>,
) {
  const found = await prisma.libraryCategory.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Library category not found", "LIBRARY_CATEGORY_NOT_FOUND");

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === id) {
      throw new AppError(400, "Category cannot be its own parent", "LIBRARY_PARENT_INVALID");
    }
    const parent = await prisma.libraryCategory.findFirst({
      where: tenantScope(tenantId, { id: input.parentId }),
      select: { id: true },
    });
    if (!parent) throw new AppError(400, "Parent category is invalid", "LIBRARY_PARENT_INVALID");
  }

  return prisma.libraryCategory.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: { _count: { select: { books: true } } },
  });
}

export async function deleteLibraryCategory(tenantId: string, id: string) {
  const found = await prisma.libraryCategory.findFirst({
    where: tenantScope(tenantId, { id }),
    select: { id: true },
  });
  if (!found) throw new AppError(404, "Library category not found", "LIBRARY_CATEGORY_NOT_FOUND");
  await prisma.libraryBook.updateMany({
    where: tenantScope(tenantId, { categoryId: id }),
    data: { categoryId: null },
  });
  await prisma.libraryCategory.delete({ where: { id } });
}

export async function listLibraryBooks(
  tenantId: string,
  query?: { q?: string; categoryId?: string; availableOnly?: boolean },
) {
  const q = query?.q?.trim();
  return prisma.libraryBook.findMany({
    where: tenantScope(tenantId, {
      ...(query?.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query?.availableOnly ? { availableCopies: { gt: 0 }, isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { author: { contains: q, mode: "insensitive" } },
              { isbn: { contains: q, mode: "insensitive" } },
              { accessionNo: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    }),
    orderBy: [{ isActive: "desc" }, { title: "asc" }],
    include: bookInclude(),
  });
}

export async function createLibraryBook(tenantId: string, input: LibraryBookInput) {
  if (input.categoryId) {
    const category = await prisma.libraryCategory.findFirst({
      where: tenantScope(tenantId, { id: input.categoryId }),
      select: { id: true },
    });
    if (!category) throw new AppError(404, "Library category not found", "LIBRARY_CATEGORY_NOT_FOUND");
  }

  const totalCopies = Math.max(1, input.totalCopies ?? 1);
  const availableCopies = Math.min(
    totalCopies,
    Math.max(0, input.availableCopies ?? totalCopies),
  );

  return prisma.libraryBook.create({
    data: {
      tenantId,
      categoryId: input.categoryId || null,
      title: input.title.trim(),
      author: input.author?.trim() || null,
      isbn: input.isbn?.trim() || null,
      accessionNo: input.accessionNo?.trim() || null,
      publisher: input.publisher?.trim() || null,
      publishedYear: input.publishedYear ?? null,
      totalCopies,
      availableCopies,
      location: input.location?.trim() || null,
      isActive: input.isActive ?? true,
      notes: input.notes?.trim() || null,
    },
    include: bookInclude(),
  });
}

export async function updateLibraryBook(
  tenantId: string,
  id: string,
  input: Partial<LibraryBookInput>,
) {
  const found = await prisma.libraryBook.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Library book not found", "LIBRARY_BOOK_NOT_FOUND");

  if (input.categoryId) {
    const category = await prisma.libraryCategory.findFirst({
      where: tenantScope(tenantId, { id: input.categoryId }),
      select: { id: true },
    });
    if (!category) throw new AppError(404, "Library category not found", "LIBRARY_CATEGORY_NOT_FOUND");
  }

  const totalCopies =
    input.totalCopies !== undefined ? Math.max(1, input.totalCopies) : found.totalCopies;
  let availableCopies =
    input.availableCopies !== undefined
      ? Math.max(0, input.availableCopies)
      : found.availableCopies;
  if (availableCopies > totalCopies) availableCopies = totalCopies;

  return prisma.libraryBook.update({
    where: { id },
    data: {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId || null } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.author !== undefined ? { author: input.author?.trim() || null } : {}),
      ...(input.isbn !== undefined ? { isbn: input.isbn?.trim() || null } : {}),
      ...(input.accessionNo !== undefined ? { accessionNo: input.accessionNo?.trim() || null } : {}),
      ...(input.publisher !== undefined ? { publisher: input.publisher?.trim() || null } : {}),
      ...(input.publishedYear !== undefined ? { publishedYear: input.publishedYear ?? null } : {}),
      ...(input.totalCopies !== undefined || input.availableCopies !== undefined
        ? { totalCopies, availableCopies }
        : {}),
      ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
    include: bookInclude(),
  });
}

export async function deleteLibraryBook(tenantId: string, id: string) {
  const found = await prisma.libraryBook.findFirst({
    where: tenantScope(tenantId, { id }),
    include: { _count: { select: { loans: { where: { status: LibraryLoanStatus.ISSUED } } } } },
  });
  if (!found) throw new AppError(404, "Library book not found", "LIBRARY_BOOK_NOT_FOUND");
  if (found._count.loans > 0) {
    throw new AppError(409, "Book has active issues; return them first", "LIBRARY_BOOK_HAS_ISSUES");
  }
  await prisma.libraryBook.delete({ where: { id } });
}

export async function listLibraryLoans(
  tenantId: string,
  query?: {
    status?: LibraryLoanStatus;
    studentId?: string;
    bookId?: string;
    overdueOnly?: boolean;
    take?: number;
  },
) {
  const now = new Date();
  return prisma.libraryLoan.findMany({
    where: tenantScope(tenantId, {
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.studentId ? { studentId: query.studentId } : {}),
      ...(query?.bookId ? { bookId: query.bookId } : {}),
      ...(query?.overdueOnly
        ? { status: LibraryLoanStatus.ISSUED, dueAt: { lt: now } }
        : {}),
    }),
    include: loanInclude(),
    orderBy: [{ issuedAt: "desc" }],
    take: query?.take ?? 200,
  });
}

export async function issueLibraryBook(
  tenantId: string,
  input: {
    bookId: string;
    studentId: string;
    dueAt?: string | Date | null;
    loanDays?: number;
    note?: string | null;
    issuedById?: string | null;
  },
) {
  const book = await prisma.libraryBook.findFirst({
    where: tenantScope(tenantId, { id: input.bookId, isActive: true }),
  });
  if (!book) throw new AppError(404, "Library book not found", "LIBRARY_BOOK_NOT_FOUND");
  if (book.availableCopies < 1) {
    throw new AppError(409, "No copies available", "LIBRARY_NO_COPIES");
  }

  const student = await prisma.student.findFirst({
    where: tenantScope(tenantId, { id: input.studentId }),
    select: { id: true },
  });
  if (!student) throw new AppError(404, "Student not found", "STUDENT_NOT_FOUND");

  const existingOpen = await prisma.libraryLoan.findFirst({
    where: tenantScope(tenantId, {
      bookId: book.id,
      studentId: student.id,
      status: LibraryLoanStatus.ISSUED,
    }),
    select: { id: true },
  });
  if (existingOpen) {
    throw new AppError(409, "Student already has this book issued", "LIBRARY_ALREADY_ISSUED");
  }

  const issuedAt = new Date();
  const dueAt = input.dueAt
    ? new Date(input.dueAt)
    : addDays(issuedAt, Math.max(1, input.loanDays ?? DEFAULT_LOAN_DAYS));

  const [loan] = await prisma.$transaction([
    prisma.libraryLoan.create({
      data: {
        tenantId,
        bookId: book.id,
        studentId: student.id,
        issuedAt,
        dueAt,
        status: LibraryLoanStatus.ISSUED,
        note: input.note?.trim() || null,
        issuedById: input.issuedById || null,
      },
      include: loanInclude(),
    }),
    prisma.libraryBook.update({
      where: { id: book.id },
      data: { availableCopies: { decrement: 1 } },
    }),
  ]);

  return loan;
}

export async function returnLibraryBook(
  tenantId: string,
  loanId: string,
  options?: {
    fineAmount?: number | null;
    note?: string | null;
    returnedById?: string | null;
    markLost?: boolean;
  },
) {
  const loan = await prisma.libraryLoan.findFirst({
    where: tenantScope(tenantId, { id: loanId }),
  });
  if (!loan) throw new AppError(404, "Library loan not found", "LIBRARY_LOAN_NOT_FOUND");
  if (loan.status !== LibraryLoanStatus.ISSUED) {
    throw new AppError(409, "Loan is already closed", "LIBRARY_LOAN_CLOSED");
  }

  const status = options?.markLost ? LibraryLoanStatus.LOST : LibraryLoanStatus.RETURNED;
  const restoredCopy = status === LibraryLoanStatus.RETURNED;

  const [updated] = await prisma.$transaction([
    prisma.libraryLoan.update({
      where: { id: loanId },
      data: {
        status,
        returnedAt: new Date(),
        fineAmount:
          options?.fineAmount != null ? new Prisma.Decimal(options.fineAmount) : loan.fineAmount,
        note: options?.note !== undefined ? options.note?.trim() || null : loan.note,
        returnedById: options?.returnedById || null,
      },
      include: loanInclude(),
    }),
    ...(restoredCopy
      ? [
          prisma.libraryBook.update({
            where: { id: loan.bookId },
            data: { availableCopies: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  return updated;
}

export async function librarySummary(tenantId: string) {
  const now = new Date();
  const [books, available, issued, overdue, categories] = await Promise.all([
    prisma.libraryBook.count({ where: tenantScope(tenantId, { isActive: true }) }),
    prisma.libraryBook.aggregate({
      where: tenantScope(tenantId, { isActive: true }),
      _sum: { availableCopies: true, totalCopies: true },
    }),
    prisma.libraryLoan.count({
      where: tenantScope(tenantId, { status: LibraryLoanStatus.ISSUED }),
    }),
    prisma.libraryLoan.count({
      where: tenantScope(tenantId, {
        status: LibraryLoanStatus.ISSUED,
        dueAt: { lt: now },
      }),
    }),
    prisma.libraryCategory.count({ where: tenantScope(tenantId, { isActive: true }) }),
  ]);

  return {
    books,
    categories,
    totalCopies: available._sum.totalCopies ?? 0,
    availableCopies: available._sum.availableCopies ?? 0,
    issued,
    overdue,
  };
}
