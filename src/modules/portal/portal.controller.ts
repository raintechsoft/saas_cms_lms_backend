import type { Request, Response } from "express";
import { z } from "zod";
import { NoticeAudience } from "@prisma/client";
import { persistAvatarUpload } from "../../lib/uploads.js";
import { getPortalOverview } from "./portal.service.js";
import {
  createPortalLeave,
  getPortalChildAttendance,
  getPortalChildDocuments,
  getPortalChildFees,
  getPortalChildHomework,
  getPortalChildLeaves,
  getPortalChildTimetable,
  listPortalNotices,
  submitPortalHomework,
  updatePortalStudentProfile,
} from "./portal-detail.service.js";
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
const homeworkBody = z.object({
  answerText: z.string().trim().min(1).max(5000),
  attachmentUrl: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
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
