import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { getThemeBrandingSetup, saveThemeBranding } from "./theme-branding.service.js";

const hex = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid color");

const nullableUrl = z.string().trim().max(500_000).nullable().optional();

const saveBody = z.object({
  brandName: z.string().trim().min(1).max(120).optional(),
  tagline: z.string().trim().max(200).optional(),
  logoUrl: nullableUrl,
  faviconUrl: nullableUrl,
  appIconUrl: nullableUrl,
  primaryColor: hex.optional(),
  secondaryColor: hex.optional(),
  accentColor: hex.optional(),
  themePreset: z.string().trim().max(40).optional(),
  themeStyle: z.enum(["light", "dark", "system"]).optional(),
  sidebarStyle: z.enum(["light", "dark"]).optional(),
  sidebarPosition: z.enum(["fixed", "scrollable"]).optional(),
  sidebarSize: z.enum(["compact", "standard", "wide"]).optional(),
  fontFamily: z.string().trim().min(1).max(80).optional(),
  headingFont: z.string().trim().min(1).max(80).optional(),
  baseFontSize: z.coerce.number().int().min(12).max(18).optional(),
  contentWidth: z.enum(["fluid", "boxed"]).optional(),
  borderRadius: z.enum(["sm", "md", "lg", "xl"]).optional(),
  density: z.enum(["compact", "comfortable", "spacious"]).optional(),
  loginBackgroundUrl: nullableUrl,
  loginWelcomeText: z.string().trim().max(200).optional(),
  showLogoOnLogin: z.boolean().optional(),
  emailHeaderColor: hex.optional(),
  emailFooterText: z.string().trim().max(500).optional(),
  emailLogoUrl: nullableUrl,
});

export async function getThemeBrandingSetupController(req: Request, res: Response) {
  res.json({ data: await getThemeBrandingSetup(req.auth!.tenantId!) });
}

export async function saveThemeBrandingController(req: Request, res: Response) {
  const body = saveBody.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { firstName: true, lastName: true, email: true },
  });
  const actor =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.email ||
    "Admin";
  res.json({
    data: await saveThemeBranding(req.auth!.tenantId!, body, actor),
  });
}
