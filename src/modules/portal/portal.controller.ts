import type { Request, Response } from "express";
import { z } from "zod";
import { NoticeAudience } from "@prisma/client";
import { persistAvatarUpload } from "../../lib/uploads.js";
import { AppError } from "../../lib/errors.js";
import { getPortalOverview } from "./portal.service.js";
import {
  createPortalLeave,
  getPortalChildAttendance,
  getPortalChildDocuments,
  getPortalChildFees,
  getPortalChildHomework,
  getPortalChildLeaves,
  getPortalChildTimetable,
  getPortalGeneratedDocument,
  listPortalNotices,
  listPortalTeachers,
  submitPortalHomework,
  submitPortalTeacherRating,
  updatePortalStudentProfile,
  uploadPortalChildDocument,
} from "./portal-detail.service.js";
import {
  getPortalOnlineAttempt,
  getPortalOnlineExamPaper,
  listPortalOnlineAttempts,
  listPortalOnlineExams,
  startPortalOnlineAttempt,
  submitPortalOnlineAttempt,
} from "./portal-online-exam.service.js";
import { createNotice, deleteNotice, listNotices, updateNotice } from "../notices/notices.service.js";

const studentParams = z.object({ studentId: z.string().min(1) });
const idParams = z.object({ id: z.string().min(1) });
const dateRange = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
const leaveBody = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().trim().min(3).max(1000),
});
const homeworkBody = z
  .object({
    answerText: z.string().trim().max(5000).nullable().optional().or(z.literal("").transform(() => null)),
    attachmentUrl: z
      .string()
      .min(1)
      .max(30_000_000)
      .refine(
        (value) =>
          value.startsWith("http://") ||
          value.startsWith("https://") ||
          value.startsWith("data:"),
        "Attachment must be a link or an uploaded file",
      )
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
  })
  .refine((value) => Boolean(value.answerText?.trim() || value.attachmentUrl), {
    message: "Answer text or attachment is required",
  });
const teacherRatingBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).nullable().optional(),
  ratingDate: z.coerce.date(),
});
const teacherParams = z.object({
  studentId: z.string().min(1),
  staffId: z.string().min(1),
});
const studentProfileBody = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  mobile: z.string().trim().max(30).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  currentAddress: z.string().trim().max(2000).nullable().optional(),
  photoUrl: z.string().trim().max(500).nullable().optional(),
});
const noticeBody = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(2).max(10000),
  attachmentUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  audience: z.nativeEnum(NoticeAudience).optional(),
  academicSessionId: z.string().min(1).nullable().optional(),
  classSectionId: z.string().min(1).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
const onlineExamParams = z.object({
  studentId: z.string().min(1),
  examId: z.string().min(1),
});
const onlineAttemptParams = z.object({
  studentId: z.string().min(1),
  attemptId: z.string().min(1),
});
const onlineSubmitBody = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedOption: z.coerce.number().int().min(0).max(9).nullable().optional(),
        textAnswer: z.string().trim().max(20000).nullable().optional(),
      }),
    )
    .max(200),
});

function viewer(req: Request) {
  return { userId: req.auth!.userId, roles: req.auth!.roles };
}

export async function getPortalOverviewController(req: Request, res: Response) {
  res.json({
    data: await getPortalOverview(req.auth!.tenantId!, viewer(req), req.auth!.productMode),
  });
}

export async function getPortalAttendanceController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  const query = dateRange.parse(req.query);
  res.json({
    data: await getPortalChildAttendance(
      req.auth!.tenantId!,
      viewer(req),
      studentId,
      query.from,
      query.to,
    ),
  });
}

export async function getPortalLeavesController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  res.json({
    data: await getPortalChildLeaves(req.auth!.tenantId!, viewer(req), studentId),
  });
}

export async function createPortalLeaveController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  res.status(201).json({
    data: await createPortalLeave(
      req.auth!.tenantId!,
      viewer(req),
      studentId,
      leaveBody.parse(req.body),
    ),
  });
}

export async function getPortalFeesController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  res.json({
    data: await getPortalChildFees(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
    ),
  });
}

export async function getPortalDocumentsController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  res.json({
    data: await getPortalChildDocuments(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
    ),
  });
}

export async function getPortalGeneratedDocumentController(req: Request, res: Response) {
  const params = z
    .object({
      studentId: z.string().min(1),
      documentId: z.string().min(1),
    })
    .parse(req.params);
  res.json({
    data: await getPortalGeneratedDocument(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      params.studentId,
      params.documentId,
    ),
  });
}

export async function uploadPortalDocumentController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  const file = req.file;
  if (!file) throw new AppError(400, "Document file is required", "FILE_REQUIRED");
  const body = z
    .object({
      folderId: z.string().min(1),
      name: z.string().trim().max(200).optional(),
    })
    .parse(req.body);
  res.status(201).json({
    data: await uploadPortalChildDocument(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
      { ...body, file },
    ),
  });
}

export async function getPortalTimetableController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  res.json({
    data: await getPortalChildTimetable(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
    ),
  });
}

export async function getPortalHomeworkController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  res.json({
    data: await getPortalChildHomework(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
    ),
  });
}

export async function submitPortalHomeworkController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = homeworkBody.parse(req.body);
  res.status(201).json({
    data: await submitPortalHomework(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      id,
      body.answerText,
      body.attachmentUrl,
    ),
  });
}

export async function listPortalTeachersController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  res.json({
    data: await listPortalTeachers(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
    ),
  });
}

export async function submitPortalTeacherRatingController(req: Request, res: Response) {
  const { studentId, staffId } = teacherParams.parse(req.params);
  const body = teacherRatingBody.parse(req.body);
  res.status(201).json({
    data: await submitPortalTeacherRating(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
      staffId,
      body,
    ),
  });
}

export async function listPortalNoticesController(req: Request, res: Response) {
  const studentId = typeof req.query.studentId === "string" ? req.query.studentId : undefined;
  res.json({
    data: await listPortalNotices(req.auth!.tenantId!, viewer(req), studentId),
  });
}

export async function updatePortalStudentProfileController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  const input = studentProfileBody.parse(req.body);
  res.json({
    data: await updatePortalStudentProfile(
      req.auth!.tenantId!,
      viewer(req),
      studentId,
      input,
    ),
  });
}

export async function uploadPortalStudentPhotoController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: { code: "FILE_REQUIRED", message: "Image file is required" } });
    return;
  }
  const photoUrl = await persistAvatarUpload(file);
  res.json({
    data: await updatePortalStudentProfile(
      req.auth!.tenantId!,
      viewer(req),
      studentId,
      { photoUrl },
    ),
  });
}

export async function listCampusNoticesController(req: Request, res: Response) {
  res.json({ data: await listNotices(req.auth!.tenantId!) });
}

export async function createCampusNoticeController(req: Request, res: Response) {
  res.status(201).json({
    data: await createNotice(
      req.auth!.tenantId!,
      req.auth!.userId,
      noticeBody.parse(req.body),
    ),
  });
}

export async function deleteCampusNoticeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteNotice(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function updateCampusNoticeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateNotice(req.auth!.tenantId!, id, noticeBody.partial().parse(req.body)),
  });
}

export async function listPortalOnlineExamsController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  res.json({
    data: await listPortalOnlineExams(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
    ),
  });
}

export async function getPortalOnlineExamPaperController(req: Request, res: Response) {
  const { studentId, examId } = onlineExamParams.parse(req.params);
  res.json({
    data: await getPortalOnlineExamPaper(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
      examId,
    ),
  });
}

export async function startPortalOnlineAttemptController(req: Request, res: Response) {
  const { studentId, examId } = onlineExamParams.parse(req.params);
  res.status(201).json({
    data: await startPortalOnlineAttempt(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
      examId,
    ),
  });
}

export async function submitPortalOnlineAttemptController(req: Request, res: Response) {
  const { studentId, attemptId } = onlineAttemptParams.parse(req.params);
  const body = onlineSubmitBody.parse(req.body);
  res.json({
    data: await submitPortalOnlineAttempt(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
      attemptId,
      body.answers,
    ),
  });
}

export async function listPortalOnlineAttemptsController(req: Request, res: Response) {
  const { studentId } = studentParams.parse(req.params);
  const examId = typeof req.query.examId === "string" ? req.query.examId : undefined;
  res.json({
    data: await listPortalOnlineAttempts(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
      examId,
    ),
  });
}

export async function getPortalOnlineAttemptController(req: Request, res: Response) {
  const { studentId, attemptId } = onlineAttemptParams.parse(req.params);
  res.json({
    data: await getPortalOnlineAttempt(
      req.auth!.tenantId!,
      viewer(req),
      req.auth!.productMode,
      studentId,
      attemptId,
    ),
  });
}
