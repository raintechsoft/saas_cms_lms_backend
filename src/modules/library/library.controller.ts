import type { Request, Response } from "express";
import { LibraryLoanStatus } from "@prisma/client";
import { z } from "zod";
import {
  createLibraryBook,
  createLibraryCategory,
  deleteLibraryBook,
  deleteLibraryCategory,
  issueLibraryBook,
  librarySummary,
  listLibraryBooks,
  listLibraryCategories,
  listLibraryLoans,
  returnLibraryBook,
  updateLibraryBook,
  updateLibraryCategory,
} from "./library.service.js";

const idParams = z.object({ id: z.string().min(1) });

const categoryBody = z.object({
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const bookBody = z.object({
  title: z.string().trim().min(1).max(250),
  categoryId: z.string().min(1).nullable().optional(),
  author: z.string().trim().max(200).nullable().optional(),
  isbn: z.string().trim().max(40).nullable().optional(),
  accessionNo: z.string().trim().max(60).nullable().optional(),
  publisher: z.string().trim().max(200).nullable().optional(),
  publishedYear: z.coerce.number().int().min(1000).max(9999).nullable().optional(),
  totalCopies: z.coerce.number().int().min(1).max(10000).optional(),
  availableCopies: z.coerce.number().int().min(0).max(10000).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const booksQuery = z.object({
  q: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  availableOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

const loansQuery = z.object({
  status: z.nativeEnum(LibraryLoanStatus).optional(),
  studentId: z.string().min(1).optional(),
  bookId: z.string().min(1).optional(),
  overdueOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  take: z.coerce.number().int().positive().max(500).optional(),
});

const issueBody = z.object({
  bookId: z.string().min(1),
  studentId: z.string().min(1),
  dueAt: z.string().datetime().nullable().optional(),
  loanDays: z.coerce.number().int().min(1).max(365).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

const returnBody = z.object({
  fineAmount: z.coerce.number().min(0).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  markLost: z.boolean().optional(),
});

export async function librarySummaryController(req: Request, res: Response) {
  res.json({ data: await librarySummary(req.auth!.tenantId!) });
}

export async function listLibraryCategoriesController(req: Request, res: Response) {
  res.json({ data: await listLibraryCategories(req.auth!.tenantId!) });
}

export async function createLibraryCategoryController(req: Request, res: Response) {
  res.status(201).json({
    data: await createLibraryCategory(req.auth!.tenantId!, categoryBody.parse(req.body)),
  });
}

export async function updateLibraryCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateLibraryCategory(
      req.auth!.tenantId!,
      id,
      categoryBody.partial().parse(req.body),
    ),
  });
}

export async function deleteLibraryCategoryController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteLibraryCategory(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listLibraryBooksController(req: Request, res: Response) {
  const query = booksQuery.parse(req.query);
  res.json({ data: await listLibraryBooks(req.auth!.tenantId!, query) });
}

export async function createLibraryBookController(req: Request, res: Response) {
  res.status(201).json({
    data: await createLibraryBook(req.auth!.tenantId!, bookBody.parse(req.body)),
  });
}

export async function updateLibraryBookController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateLibraryBook(req.auth!.tenantId!, id, bookBody.partial().parse(req.body)),
  });
}

export async function deleteLibraryBookController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteLibraryBook(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listLibraryLoansController(req: Request, res: Response) {
  const query = loansQuery.parse(req.query);
  res.json({ data: await listLibraryLoans(req.auth!.tenantId!, query) });
}

export async function issueLibraryBookController(req: Request, res: Response) {
  const body = issueBody.parse(req.body);
  res.status(201).json({
    data: await issueLibraryBook(req.auth!.tenantId!, {
      ...body,
      issuedById: req.auth!.userId,
    }),
  });
}

export async function returnLibraryBookController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = returnBody.parse(req.body ?? {});
  res.json({
    data: await returnLibraryBook(req.auth!.tenantId!, id, {
      ...body,
      returnedById: req.auth!.userId,
    }),
  });
}
