import type { Request, Response } from "express";
import { z } from "zod";
import {
  createWebsiteMedia,
  createWebsitePage,
  deleteWebsiteBanner,
  deleteWebsiteMedia,
  deleteWebsiteMenu,
  deleteWebsiteMenuItem,
  deleteWebsitePage,
  getWebsiteCmsSetup,
  saveWebsiteSiteSettings,
  updateWebsitePage,
  upsertWebsiteBanner,
  upsertWebsiteMenu,
  upsertWebsiteMenuItem,
} from "./website-cms.service.js";

const idParams = z.object({ id: z.string().min(1) });

const pageBody = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(200).optional(),
  excerpt: z.string().trim().max(2000).nullable().optional(),
  content: z.string().trim().max(100_000).nullable().optional(),
  menuKey: z.string().trim().max(40).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
});

const menuBody = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  key: z.string().trim().min(1).max(40),
  isActive: z.boolean().optional(),
});

const menuItemBody = z.object({
  id: z.string().min(1).optional(),
  menuId: z.string().min(1),
  label: z.string().trim().min(1).max(100),
  url: z.string().trim().max(500).nullable().optional(),
  pageId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

const mediaBody = z.object({
  name: z.string().trim().min(1).max(200),
  fileUrl: z.string().trim().min(1).max(500_000),
  mimeType: z.string().trim().max(100).nullable().optional(),
  sizeBytes: z.coerce.number().int().min(0).nullable().optional(),
});

const bannerBody = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(500).nullable().optional(),
  imageUrl: z.string().trim().max(500_000).nullable().optional(),
  linkUrl: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

const siteSettingsBody = z.object({
  siteTitle: z.string().trim().max(200).nullable().optional(),
  siteTagline: z.string().trim().max(200).nullable().optional(),
  defaultSeoTitle: z.string().trim().max(200).nullable().optional(),
  defaultSeoDesc: z.string().trim().max(500).nullable().optional(),
  contactEmail: z.string().trim().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  socialFacebook: z.string().trim().max(300).nullable().optional(),
  socialInstagram: z.string().trim().max(300).nullable().optional(),
  socialYoutube: z.string().trim().max(300).nullable().optional(),
  googleAnalyticsId: z.string().trim().max(80).nullable().optional(),
  homepagePageId: z.string().min(1).nullable().optional(),
  maintenanceMode: z.boolean().optional(),
});

export async function getWebsiteCmsSetupController(req: Request, res: Response) {
  res.json({ data: await getWebsiteCmsSetup(req.auth!.tenantId!) });
}

export async function createWebsitePageController(req: Request, res: Response) {
  res.status(201).json({
    data: await createWebsitePage(
      req.auth!.tenantId!,
      req.auth!.userId,
      pageBody.parse(req.body),
    ),
  });
}

export async function updateWebsitePageController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({
    data: await updateWebsitePage(
      req.auth!.tenantId!,
      req.auth!.userId,
      id,
      pageBody.partial().parse(req.body),
    ),
  });
}

export async function deleteWebsitePageController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteWebsitePage(req.auth!.tenantId!, id) });
}

export async function upsertWebsiteMenuController(req: Request, res: Response) {
  res.json({
    data: await upsertWebsiteMenu(req.auth!.tenantId!, menuBody.parse(req.body)),
  });
}

export async function deleteWebsiteMenuController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteWebsiteMenu(req.auth!.tenantId!, id) });
}

export async function upsertWebsiteMenuItemController(req: Request, res: Response) {
  res.json({
    data: await upsertWebsiteMenuItem(req.auth!.tenantId!, menuItemBody.parse(req.body)),
  });
}

export async function deleteWebsiteMenuItemController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteWebsiteMenuItem(req.auth!.tenantId!, id) });
}

export async function createWebsiteMediaController(req: Request, res: Response) {
  res.status(201).json({
    data: await createWebsiteMedia(
      req.auth!.tenantId!,
      req.auth!.userId,
      mediaBody.parse(req.body),
    ),
  });
}

export async function deleteWebsiteMediaController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteWebsiteMedia(req.auth!.tenantId!, id) });
}

export async function upsertWebsiteBannerController(req: Request, res: Response) {
  res.json({
    data: await upsertWebsiteBanner(req.auth!.tenantId!, bannerBody.parse(req.body)),
  });
}

export async function deleteWebsiteBannerController(req: Request, res: Response) {
  const { id } = idParams.parse(req.params);
  res.json({ data: await deleteWebsiteBanner(req.auth!.tenantId!, id) });
}

export async function saveWebsiteSiteSettingsController(req: Request, res: Response) {
  res.json({
    data: await saveWebsiteSiteSettings(
      req.auth!.tenantId!,
      siteSettingsBody.parse(req.body),
    ),
  });
}
