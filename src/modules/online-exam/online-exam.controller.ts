import type { Request, Response } from "express";
import {
  OnlineAttemptStatus,
  OnlineExamStatus,
  OnlineQuestionType,
} from "@prisma/client";
import { z } from "zod";
import {
  createOnlineExam,
  createOnlineQuestion,
  deleteOnlineExam,
  deleteOnlineQuestion,
  getOnlineExam,
  gradeSubjectiveAnswer,
  listExamRanks,
  listOnlineAttempts,
  listOnlineExams,
  listOnlineQuestions,
  listPendingSubjectiveGrades,
  onlineExamSummary,
  startOnlineAttempt,
  submitOnlineAttempt,
  updateOnlineExam,
  updateOnlineQuestion,
} from "./online-exam.service.js";

const idParams = z.object({ id: z.string().min(1) });
const examIdParams = z.object({ examId: z.string().min(1) });

const examBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  academicSessionId: z.string().min(1).nullable().optional(),
  classSectionId: z.string().min(1).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(600).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(20).optional(),
  passMarks: z.coerce.number().int().min(0).max(10000).optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  status: z.nativeEnum(OnlineExamStatus).optional(),
});

const questionBody = z.object({
  type: z.nativeEnum(OnlineQuestionType),
  prompt: z.string().trim().min(1).max(10000),
  options: z.array(z.string().trim().min(1).max(500)).max(10).nullable().optional(),
  correctOption: z.coerce.number().int().min(0).max(9).nullable().optional(),
  marks: z.coerce.number().int().min(1).max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

const startAttemptBody = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
});

const submitAttemptBody = z.object({
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

const gradeBody = z.object({
  marksAwarded: z.coerce.number().min(0).max(1000),
});

const listAttemptsQuery = z.object({
  examId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  status: z.nativeEnum(OnlineAttemptStatus).optional(),
});

export async function onlineExamSummaryController(req: Request, res: Response) {
  res.json({ data: await onlineExamSummary(req.auth!.tenantId!) });
}

export async function listOnlineExamsController(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  res.json({ data: await listOnlineExams(req.auth!.tenantId!, q) });
}

export async function getOnlineExamController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getOnlineExam(req.auth!.tenantId!, id) });
}

export async function createOnlineExamController(req: Request, res: Response) {
  res.status(201).json({
    data: await createOnlineExam(
      req.auth!.tenantId!,
      examBody.parse(req.body),
      req.auth!.userId,
    ),
  });
}

export async function updateOnlineExamController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateOnlineExam(
      req.auth!.tenantId!,
      id,
      examBody.partial().parse(req.body),
    ),
  });
}

export async function deleteOnlineExamController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteOnlineExam(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listOnlineQuestionsController(req: Request, res: Response) {
  const { examId } = examIdParams.parse(req.params);
  res.json({ data: await listOnlineQuestions(req.auth!.tenantId!, examId) });
}

export async function createOnlineQuestionController(req: Request, res: Response) {
  const { examId } = examIdParams.parse(req.params);
  res.status(201).json({
    data: await createOnlineQuestion(
      req.auth!.tenantId!,
      examId,
      questionBody.parse(req.body),
    ),
  });
}

export async function updateOnlineQuestionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateOnlineQuestion(
      req.auth!.tenantId!,
      id,
      questionBody.partial().parse(req.body),
    ),
  });
}

export async function deleteOnlineQuestionController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteOnlineQuestion(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listOnlineAttemptsController(req: Request, res: Response) {
  const query = listAttemptsQuery.parse(req.query);
  res.json({ data: await listOnlineAttempts(req.auth!.tenantId!, query) });
}

export async function startOnlineAttemptController(req: Request, res: Response) {
  res.status(201).json({
    data: await startOnlineAttempt(req.auth!.tenantId!, startAttemptBody.parse(req.body)),
  });
}

export async function submitOnlineAttemptController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = submitAttemptBody.parse(req.body);
  res.json({
    data: await submitOnlineAttempt(req.auth!.tenantId!, id, body.answers),
  });
}

export async function gradeSubjectiveAnswerController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = gradeBody.parse(req.body);
  res.json({
    data: await gradeSubjectiveAnswer(req.auth!.tenantId!, id, {
      marksAwarded: body.marksAwarded,
      gradedById: req.auth!.userId,
    }),
  });
}

export async function listExamRanksController(req: Request, res: Response) {
  const { examId } = examIdParams.parse(req.params);
  res.json({ data: await listExamRanks(req.auth!.tenantId!, examId) });
}

export async function listPendingSubjectiveGradesController(req: Request, res: Response) {
  const examId = typeof req.query.examId === "string" ? req.query.examId : undefined;
  res.json({ data: await listPendingSubjectiveGrades(req.auth!.tenantId!, examId) });
}
