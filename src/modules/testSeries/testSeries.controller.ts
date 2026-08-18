import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";
import {
  addQuestionsByIds,
  archivePaper,
  archiveTestSeries,
  createPaper,
  createTestSeries,
  deletePaper,
  deleteTestSeries,
  getPaper,
  getTestSeriesById,
  getTestSeriesModuleSettings,
  listTestSeries,
  publishPaper,
  publishTestSeries,
  pullQuestionsFromBank,
  removePaperQuestion,
  reorderPaperQuestions,
  updatePaper,
  updatePaperQuestionMarks,
  updateTestSeries,
  updateTestSeriesModuleSettings,
} from "./testSeries.service.js";

function tenantId(req: Request) {
  const id = req.auth?.tenantId;
  if (!id) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  return id;
}

function userId(req: Request) {
  const id = req.auth?.userId;
  if (!id) throw new AppError(401, "Unauthenticated", "AUTH_REQUIRED");
  return id;
}

const idParams = z.object({ id: z.string().min(1) });
const seriesPaperParams = z.object({
  id: z.string().min(1),
  paperId: z.string().min(1),
});
const linkParams = z.object({
  id: z.string().min(1),
  paperId: z.string().min(1),
  linkId: z.string().min(1),
});

const listQuery = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  subjectId: z.string().min(1).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const seriesBody = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  subjectId: z.string().min(1).nullable().optional(),
  classId: z.string().min(1).nullable().optional(),
});

/** Status is intentionally omitted — use publish/archive endpoints. */
const seriesUpdateBody = seriesBody.partial();

const paperBody = z.object({
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(10000).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  passMarks: z.coerce.number().min(0).max(10000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

/** Status is intentionally omitted — use publish/archive endpoints. */
const paperUpdateBody = paperBody.partial();

const addByIdsBody = z.object({
  questionIds: z.array(z.string().min(1)).min(1).max(100),
});

const pullBody = z.object({
  count: z.coerce.number().int().min(1).max(100),
  subjectId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  difficultyLevelId: z.string().min(1).optional(),
  questionTypeId: z.string().min(1).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

const reorderBody = z.object({
  orderedLinkIds: z.array(z.string().min(1)).min(1).max(200),
});

const linkMarksBody = z.object({
  marks: z.coerce.number().min(0).max(1000),
});

const settingsBody = z.object({
  allowTeachersToCreateTestSeries: z.boolean(),
});

export async function listSeriesController(req: Request, res: Response) {
  const query = listQuery.parse(req.query);
  res.json({ data: await listTestSeries(tenantId(req), query) });
}

export async function getSeriesController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getTestSeriesById(tenantId(req), id) });
}

export async function createSeriesController(req: Request, res: Response) {
  const body = seriesBody.parse(req.body);
  res.status(201).json({
    data: await createTestSeries(tenantId(req), userId(req), body),
  });
}

export async function updateSeriesController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = seriesUpdateBody.parse(req.body);
  res.json({ data: await updateTestSeries(tenantId(req), id, body) });
}

export async function publishSeriesController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await publishTestSeries(tenantId(req), id) });
}

export async function archiveSeriesController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await archiveTestSeries(tenantId(req), id) });
}

export async function deleteSeriesController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteTestSeries(tenantId(req), id) });
}

export async function createPaperController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = paperBody.parse(req.body);
  res.status(201).json({ data: await createPaper(tenantId(req), id, body) });
}

export async function getPaperController(req: Request, res: Response) {
  const { id, paperId } = seriesPaperParams.parse(req.params);
  res.json({ data: await getPaper(tenantId(req), id, paperId) });
}

export async function updatePaperController(req: Request, res: Response) {
  const { id, paperId } = seriesPaperParams.parse(req.params);
  const body = paperUpdateBody.parse(req.body);
  res.json({ data: await updatePaper(tenantId(req), id, paperId, body) });
}

export async function publishPaperController(req: Request, res: Response) {
  const { id, paperId } = seriesPaperParams.parse(req.params);
  res.json({ data: await publishPaper(tenantId(req), id, paperId) });
}

export async function archivePaperController(req: Request, res: Response) {
  const { id, paperId } = seriesPaperParams.parse(req.params);
  res.json({ data: await archivePaper(tenantId(req), id, paperId) });
}

export async function deletePaperController(req: Request, res: Response) {
  const { id, paperId } = seriesPaperParams.parse(req.params);
  res.json({ data: await deletePaper(tenantId(req), id, paperId) });
}

export async function addQuestionsController(req: Request, res: Response) {
  const { id, paperId } = seriesPaperParams.parse(req.params);
  const body = addByIdsBody.parse(req.body);
  res.json({ data: await addQuestionsByIds(tenantId(req), id, paperId, body.questionIds) });
}

export async function pullQuestionsController(req: Request, res: Response) {
  const { id, paperId } = seriesPaperParams.parse(req.params);
  const body = pullBody.parse(req.body);
  res.json({ data: await pullQuestionsFromBank(tenantId(req), id, paperId, body) });
}

export async function updateQuestionLinkController(req: Request, res: Response) {
  const { id, paperId, linkId } = linkParams.parse(req.params);
  const body = linkMarksBody.parse(req.body);
  res.json({
    data: await updatePaperQuestionMarks(tenantId(req), id, paperId, linkId, body.marks),
  });
}

export async function removeQuestionController(req: Request, res: Response) {
  const { id, paperId, linkId } = linkParams.parse(req.params);
  res.json({ data: await removePaperQuestion(tenantId(req), id, paperId, linkId) });
}

export async function reorderQuestionsController(req: Request, res: Response) {
  const { id, paperId } = seriesPaperParams.parse(req.params);
  const body = reorderBody.parse(req.body);
  res.json({
    data: await reorderPaperQuestions(tenantId(req), id, paperId, body.orderedLinkIds),
  });
}

export async function getSettingsController(req: Request, res: Response) {
  res.json({ data: await getTestSeriesModuleSettings(tenantId(req)) });
}

export async function updateSettingsController(req: Request, res: Response) {
  const body = settingsBody.parse(req.body);
  res.json({
    data: await updateTestSeriesModuleSettings(
      tenantId(req),
      body.allowTeachersToCreateTestSeries,
    ),
  });
}
