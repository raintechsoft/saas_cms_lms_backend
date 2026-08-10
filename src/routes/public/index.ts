import { Gender } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/errors.js";
import {
  receiveWhatsAppWebhookController,
  verifyWhatsAppWebhookController,
} from "../../modules/erp/whatsapp-gateway.controller.js";
import {
  getPublicAdmissionForm,
  submitPublicAdmission,
} from "../../modules/students/admissions.service.js";

const slugParams = z.object({ slug: z.string().trim().min(1).max(80) });
const admissionBody = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).nullable().optional(),
  gender: z.nativeEnum(Gender).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  mobile: z.string().trim().max(30).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  fatherName: z.string().trim().max(100).nullable().optional(),
  motherName: z.string().trim().max(100).nullable().optional(),
  guardianPhone: z.string().trim().max(30).nullable().optional(),
  currentAddress: z.string().trim().max(1000).nullable().optional(),
  classSectionId: z.string().min(1).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const publicRouter = Router();

publicRouter.get("/whatsapp/webhook", asyncHandler(verifyWhatsAppWebhookController));
publicRouter.post("/whatsapp/webhook", asyncHandler(receiveWhatsAppWebhookController));

publicRouter.get(
  "/tenants/:slug/admission",
  asyncHandler(async (req, res) => {
    const { slug } = slugParams.parse(req.params);
    res.json({ data: await getPublicAdmissionForm(slug) });
  }),
);

publicRouter.post(
  "/tenants/:slug/admission",
  asyncHandler(async (req, res) => {
    const { slug } = slugParams.parse(req.params);
    const body = admissionBody.parse(req.body);
    const data = await submitPublicAdmission(slug, body);
    res.status(201).json({ data });
  }),
);
