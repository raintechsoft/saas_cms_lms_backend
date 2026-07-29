import { UserStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  createRole,
  createUser,
  deleteRole,
  deleteUser,
  getUser,
  listPermissions,
  listRoles,
  listUsers,
  updateRole,
  updateUser,
} from "./access.service.js";

const idParams = z.object({ id: z.string().min(1) });
const roleBody = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(60)
    .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "_")),
  description: z.string().trim().max(500).nullable().optional(),
  permissionIds: z.array(z.string().min(1)).default([]),
});
const updateRoleBody = roleBody.omit({ code: true });
const createUserBody = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(30)
    .refine((value) => value.replace(/\D/g, "").length >= 10, "Mobile number is required"),
  roleIds: z.array(z.string().min(1)).min(1),
});
const updateUserBody = z.object({
  email: z.string().email().optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(8).max(128).optional(),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(30)
    .refine((value) => value.replace(/\D/g, "").length >= 10, "Mobile number is required")
    .optional(),
  status: z.nativeEnum(UserStatus).optional(),
  roleIds: z.array(z.string().min(1)).min(1).optional(),
}).strict();

export async function listPermissionsController(_req: Request, res: Response) {
  res.json({ data: await listPermissions() });
}

export async function listRolesController(req: Request, res: Response) {
  res.json({ data: await listRoles(req.auth!.tenantId!) });
}

export async function createRoleController(req: Request, res: Response) {
  const data = await createRole(req.auth!.tenantId!, roleBody.parse(req.body));
  res.status(201).json({ data });
}

export async function updateRoleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateRole(req.auth!.tenantId!, id, updateRoleBody.parse(req.body)),
  });
}

export async function deleteRoleController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  await deleteRole(req.auth!.tenantId!, id);
  res.status(204).send();
}

export async function listUsersController(req: Request, res: Response) {
  res.json({ data: await listUsers(req.auth!.tenantId!) });
}

export async function getUserController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await getUser(req.auth!.tenantId!, id) });
}

export async function createUserController(req: Request, res: Response) {
  const data = await createUser(req.auth!.tenantId!, createUserBody.parse(req.body));
  res.status(201).json({ data });
}

export async function updateUserController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateUser(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
      updateUserBody.parse(req.body),
    ),
  });
}

export async function deleteUserController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  const result = await deleteUser(req.auth!.tenantId!, req.auth!.userId, id);
  if (result.mode === "deleted") {
    res.status(204).send();
    return;
  }
  res.json({ data: result.user, meta: { mode: result.mode } });
}
