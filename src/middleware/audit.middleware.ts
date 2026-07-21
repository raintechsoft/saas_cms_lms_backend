import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const readOnlyMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function auditTenantMutation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (readOnlyMethods.has(req.method) || !req.auth?.tenantId) {
    next();
    return;
  }
  const { tenantId, userId } = req.auth;
  const path = req.path;
  res.once("finish", () => {
    if (res.statusCode >= 400) return;
    const entityType = path.split("/").filter(Boolean)[0]?.toUpperCase() ?? "UNKNOWN";
    void prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: `${req.method} ${path}`,
        entityType,
        metadata: { statusCode: res.statusCode },
      },
    }).catch((error: unknown) => {
      console.error("Unable to record tenant audit event", error);
    });
  });
  next();
}
