import type { Request, Response } from "express";
import { getSystemFieldsSetup } from "./system-fields.service.js";

export async function getSystemFieldsSetupController(req: Request, res: Response) {
  res.json({ data: await getSystemFieldsSetup(req.auth!.tenantId!) });
}
