import { ExamResultType, PassStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  addMarkComponent,
  archiveExam,
  assignExamStudents,
  createExam,
  createExamAspect,
  createExamGrade,
  createExamGroup,
  createExamSchedule,
  deleteExam,
  deleteExamGrade,
  deleteExamGroup,
  deleteExamSchedule,
  getExamResults,
  getExamGroupResults,
  getExamSetup,
  getScheduleRoster,
  publishExam,
  saveAspectValues,
  saveExamMarks,
  updateExam,
  updateExamGrade,
  updateExamGroup,
  updateExamSchedule,
} from "./exams.service.js";

const idParams = z.object({ id: z.string().min(1) });
const nestedIdParams = z.object({
  id: z.string().min(1),
  scheduleId: z.string().min(1).optional(),
});
const gradeBody = z.object({
  resultType: z.nativeEnum(ExamResultType),
  name: z.string().trim().min(1).max(30),
  minPercent: z.coerce.number().min(0).max(100),
  maxPercent: z.coerce.number().min(0).max(100),
  gradePoint: z.coerce.number().min(0).max(20).nullable().optional(),
  passStatus: z.nativeEnum(PassStatus),
});
const groupBody = z.object({
  academicSessionId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  resultType: z.nativeEnum(ExamResultType),
  description: z.string().trim().max(1000).nullable().optional(),
});
const examBody = z.object({
  examGroupId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});
const scheduleBody = z.object({
  classSectionId: z.string().min(1),
  classSubjectId: z.string().min(1),
  examDate: z.coerce.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().trim().max(50).nullable().optional(),
  maximumMarks: z.coerce.number().positive(),
  minimumMarks: z.coerce.number().min(0),
});
const componentBody = z.object({
  name: z.string().trim().min(1).max(50),
  maximumMarks: z.coerce.number().positive(),
});
const assignBody = z.object({
  classSectionId: z.string().min(1),
  enrollmentIds: z.array(z.string().min(1)).optional(),
});
const markEntriesBody = z.object({
  entries: z.array(z.object({
    examStudentId: z.string().min(1),
    marksObtained: z.coerce.number().min(0),
    isAbsent: z.boolean().optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
    componentScores: z.array(z.object({
      componentId: z.string().min(1),
      marks: z.coerce.number().min(0),
    })).optional(),
  })).min(1),
});
const aspectBody = z.object({
  name: z.string().trim().min(1).max(100),
  maximumValue: z.coerce.number().positive(),
});
const aspectValuesBody = z.object({
  entries: z.array(z.object({
    examStudentId: z.string().min(1),
    value: z.coerce.number().min(0),
    remarks: z.string().trim().max(500).nullable().optional(),
  })).min(1),
});

export async function getExamSetupController(req: Request, res: Response) {
  res.json({ data: await getExamSetup(req.auth!.tenantId!) });
}

export async function createExamGradeController(req: Request, res: Response) {
  res.status(201).json({
    data: await createExamGrade(req.auth!.tenantId!, gradeBody.parse(req.body)),
  });
}

export async function createExamGroupController(req: Request, res: Response) {
  res.status(201).json({
    data: await createExamGroup(req.auth!.tenantId!, groupBody.parse(req.body)),
  });
}

export async function createExamController(req: Request, res: Response) {
  res.status(201).json({
    data: await createExam(req.auth!.tenantId!, examBody.parse(req.body)),
  });
}

export async function createExamScheduleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.status(201).json({
    data: await createExamSchedule(req.auth!.tenantId!, id, scheduleBody.parse(req.body)),
  });
}

export async function addMarkComponentController(req: Request, res: Response) {
  const { scheduleId } = nestedIdParams.parse(req.params);
  res.status(201).json({
    data: await addMarkComponent(
      req.auth!.tenantId!,
      scheduleId!,
      componentBody.parse(req.body),
    ),
  });
}

export async function assignExamStudentsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await assignExamStudents(req.auth!.tenantId!, id, assignBody.parse(req.body)),
  });
}

export async function getScheduleRosterController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getScheduleRoster(req.auth!.tenantId!, id) });
}

export async function saveExamMarksController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { entries } = markEntriesBody.parse(req.body);
  res.json({ data: await saveExamMarks(req.auth!.tenantId!, id, entries) });
}

export async function createExamAspectController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.status(201).json({
    data: await createExamAspect(req.auth!.tenantId!, id, aspectBody.parse(req.body)),
  });
}

export async function saveAspectValuesController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { entries } = aspectValuesBody.parse(req.body);
  res.json({ data: await saveAspectValues(req.auth!.tenantId!, id, entries) });
}

export async function publishExamController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await publishExam(req.auth!.tenantId!, id) });
}

export async function getExamResultsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getExamResults(req.auth!.tenantId!, id) });
}

export async function getExamGroupResultsController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getExamGroupResults(req.auth!.tenantId!, id) });
}

const gradeUpdateBody = gradeBody.partial().omit({ resultType: true });
const groupUpdateBody = groupBody.partial().omit({ academicSessionId: true });
const examUpdateBody = examBody.partial().omit({ examGroupId: true });
const scheduleUpdateBody = scheduleBody.partial().omit({ classSectionId: true, classSubjectId: true });

export async function updateExamGradeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await updateExamGrade(req.auth!.tenantId!, id, gradeUpdateBody.parse(req.body)) });
}

export async function deleteExamGradeController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteExamGrade(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function updateExamGroupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await updateExamGroup(req.auth!.tenantId!, id, groupUpdateBody.parse(req.body)) });
}

export async function deleteExamGroupController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteExamGroup(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function updateExamController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await updateExam(req.auth!.tenantId!, id, examUpdateBody.parse(req.body)) });
}

export async function archiveExamController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await archiveExam(req.auth!.tenantId!, id) });
}

export async function deleteExamController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteExam(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function updateExamScheduleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateExamSchedule(req.auth!.tenantId!, id, scheduleUpdateBody.parse(req.body)),
  });
}

export async function deleteExamScheduleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteExamSchedule(req.auth!.tenantId!, id);
  res.status(204).send();
}
