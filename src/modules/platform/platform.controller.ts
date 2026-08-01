import type { Request, Response } from "express";
import { z } from "zod";
import {
  DistributionModel,
  ProductMode,
  TenantStatus,
  TenantType,
  UserStatus,
} from "@prisma/client";
import {
  assignTenantsToReseller,
  createReseller,
  createTenant,
  getPlatformAudit,
  getPlatformSettings,
  getPlatformStats,
  getResellerDetail,
  getTenantDetail,
  listPlatformUsers,
  listResellers,
  listTenants,
  deletePlatformUser,
  setTenantStatus,
  setUserStatus,
  updatePlatformSettings,
  updatePlatformUser,
  updateReseller,
  updateTenant,
} from "./platform.service.js";

const brandingSchema = z.record(z.string(), z.unknown());
const idParams = z.object({ id: z.string().min(1) });

const createTenantBody = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(80).optional(),
  type: z.nativeEnum(TenantType),
  productMode: z.nativeEnum(ProductMode),
  distributionModel: z.nativeEnum(DistributionModel).optional(),
  resellerId: z.string().min(1).nullable().optional(),
  branding: brandingSchema.optional(),
  modules: z.array(z.string().trim().min(1)).max(50).optional(),
  adminEmail: z.string().email().max(200),
  adminPhone: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .refine((value) => value.replace(/\D/g, "").length >= 10, "Mobile number is required"),
  adminPassword: z.string().min(8).max(200).optional(),
  adminFirstName: z.string().trim().max(80).optional(),
  adminLastName: z.string().trim().max(80).optional(),
});

const updateTenantBody = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  type: z.nativeEnum(TenantType).optional(),
  productMode: z.nativeEnum(ProductMode).optional(),
  distributionModel: z.nativeEnum(DistributionModel).optional(),
  resellerId: z.string().min(1).nullable().optional(),
  branding: brandingSchema.nullable().optional(),
  modules: z.array(z.string().trim().min(1)).max(50).optional(),
});

const statusBody = z.object({ status: z.nativeEnum(TenantStatus) });
const userStatusBody = z.object({ status: z.nativeEnum(UserStatus) });
const updatePlatformUserBody = z
  .object({
    email: z.string().email().optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    status: z.nativeEnum(UserStatus).optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .strict();
const createResellerBody = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(80).optional(),
  branding: brandingSchema.optional(),
});
const updateResellerBody = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  branding: brandingSchema.nullable().optional(),
});
const assignTenantsBody = z.object({
  tenantIds: z.array(z.string().min(1)).max(500),
});
const platformSettingsBody = z.object({
  branding: brandingSchema.optional(),
});

export async function getPlatformStatsController(_req: Request, res: Response) {
  res.json({ data: await getPlatformStats() });
}

export async function listTenantsController(req: Request, res: Response) {
  const query = z
    .object({
      search: z.string().trim().optional(),
      status: z.nativeEnum(TenantStatus).optional(),
      type: z.nativeEnum(TenantType).optional(),
      productMode: z.nativeEnum(ProductMode).optional(),
      resellerId: z.string().min(1).optional(),
    })
    .parse(req.query);
  res.json({ data: await listTenants(query) });
}

export async function getTenantDetailController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getTenantDetail(id) });
}

export async function createTenantController(req: Request, res: Response) {
  const body = createTenantBody.parse(req.body);
  res.status(201).json({ data: await createTenant(body) });
}

export async function updateTenantController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = updateTenantBody.parse(req.body);
  res.json({ data: await updateTenant(id, body) });
}

export async function setTenantStatusController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { status } = statusBody.parse(req.body);
  res.json({ data: await setTenantStatus(id, status) });
}

export async function listResellersController(_req: Request, res: Response) {
  res.json({ data: await listResellers() });
}

export async function getResellerDetailController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getResellerDetail(id) });
}

export async function createResellerController(req: Request, res: Response) {
  const body = createResellerBody.parse(req.body);
  res.status(201).json({ data: await createReseller(body) });
}

export async function updateResellerController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = updateResellerBody.parse(req.body);
  res.json({ data: await updateReseller(id, body) });
}

export async function assignTenantsToResellerController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const body = assignTenantsBody.parse(req.body);
  res.json({ data: await assignTenantsToReseller(id, body.tenantIds) });
}

export async function listPlatformUsersController(req: Request, res: Response) {
  const query = z
    .object({
      search: z.string().trim().optional(),
      tenantId: z.string().min(1).optional(),
      status: z.nativeEnum(UserStatus).optional(),
      role: z.string().trim().optional(),
    })
    .parse(req.query);
  res.json({ data: await listPlatformUsers(query) });
}

export async function setUserStatusController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const { status } = userStatusBody.parse(req.body);
  res.json({ data: await setUserStatus(id, status, req.auth!.userId) });
}

export async function updatePlatformUserController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updatePlatformUser(id, req.auth!.userId, updatePlatformUserBody.parse(req.body)),
  });
}

export async function deletePlatformUserController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const result = await deletePlatformUser(id, req.auth!.userId);
  if (result.mode === "deleted") {
    res.status(204).send();
    return;
  }
  res.json({ data: result.user, meta: { mode: result.mode } });
}

export async function getPlatformAuditController(req: Request, res: Response) {
  const query = z
    .object({
      tenantId: z.string().min(1).optional(),
      action: z.string().trim().optional(),
      actor: z.string().trim().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      limit: z.coerce.number().int().min(1).max(300).optional(),
    })
    .parse(req.query);
  res.json({ data: await getPlatformAudit(query) });
}

export async function getPlatformSettingsController(_req: Request, res: Response) {
  res.json({ data: await getPlatformSettings() });
}

export async function updatePlatformSettingsController(req: Request, res: Response) {
  const body = platformSettingsBody.parse(req.body);
  res.json({ data: await updatePlatformSettings(body) });
}
