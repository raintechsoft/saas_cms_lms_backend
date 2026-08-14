import type { NextFunction, Request, Response } from "express";
import { AppError, asyncHandler } from "../lib/errors.js";
import { resolveAuthContext } from "../modules/auth/auth.service.js";
import {
  assertEntitlement,
  type ModuleEntitlement,
} from "../modules/tenants/tenant.service.js";
import { prisma } from "../lib/prisma.js";
import { isManualEnableModuleKey } from "../lib/module-keys.js";

export const authenticate = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "Bearer access token required", "AUTH_REQUIRED");
  }

  req.auth = await resolveAuthContext(token);
  next();
});

export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.tenantId) {
    return next(new AppError(403, "A tenant context is required", "TENANT_REQUIRED"));
  }
  next();
}

export function requirePlatform(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.tenantId || !req.auth?.permissions.includes("platform.manage")) {
    return next(new AppError(403, "Platform administrator access is required", "PLATFORM_REQUIRED"));
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.permissions.includes(permission)) {
      return next(new AppError(403, "Insufficient permission", "FORBIDDEN"));
    }
    next();
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!permissions.some((permission) => req.auth?.permissions.includes(permission))) {
      return next(new AppError(403, "Insufficient permission", "FORBIDDEN"));
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.roles.some((role) => roles.includes(role))) {
      return next(new AppError(403, "Insufficient role", "FORBIDDEN"));
    }
    next();
  };
}

export function requireEntitlement(module: ModuleEntitlement) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      assertEntitlement(req.auth?.productMode ?? null, module);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireModule(moduleKey: string) {
  return asyncHandler(async (req, _res, next) => {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) throw new AppError(403, "A tenant context is required", "TENANT_REQUIRED");
    const setting = await prisma.tenantModuleSetting.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
    });
    // Unlicensed / manual modules: missing row means OFF (never implied on).
    // Legacy modules: missing row means ON (pre-toggle tenants).
    if (!setting) {
      if (isManualEnableModuleKey(moduleKey)) {
        throw new AppError(403, "This module is disabled for the current panel", "MODULE_DISABLED");
      }
      return next();
    }
    const enabled = req.auth!.roles.includes("STUDENT")
      ? setting.studentEnabled
      : req.auth!.roles.includes("PARENT")
        ? setting.parentEnabled
        : setting.adminEnabled;
    if (!enabled) {
      throw new AppError(403, "This module is disabled for the current panel", "MODULE_DISABLED");
    }
    next();
  });
}
