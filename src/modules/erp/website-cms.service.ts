import type { WebsitePageStatus } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { tenantScope } from "../../lib/tenant-scope.js";

const MENU_LABELS: Record<string, string> = {
  MAIN: "Main Menu",
  FOOTER: "Footer Menu",
  QUICK: "Quick Links",
  NONE: "—",
};

const DEFAULT_MENUS = [
  { name: "Main Menu", key: "MAIN", sortOrder: 1 },
  { name: "Footer Menu", key: "FOOTER", sortOrder: 2 },
  { name: "Quick Links", key: "QUICK", sortOrder: 3 },
];

const DEFAULT_PAGES = [
  {
    title: "Home",
    slug: "/",
    menuKey: "MAIN",
    status: "PUBLISHED" as WebsitePageStatus,
    excerpt: "School homepage",
    content: "Welcome to our school website.",
    sortOrder: 1,
  },
  {
    title: "About Us",
    slug: "/about-us",
    menuKey: "MAIN",
    status: "PUBLISHED" as WebsitePageStatus,
    excerpt: "Learn about our institution",
    content: "About our school, vision and mission.",
    sortOrder: 2,
  },
  {
    title: "Admissions",
    slug: "/admissions",
    menuKey: "MAIN",
    status: "PUBLISHED" as WebsitePageStatus,
    excerpt: "Admission process and forms",
    content: "Apply for admission online.",
    sortOrder: 3,
  },
  {
    title: "Academics",
    slug: "/academics",
    menuKey: "MAIN",
    status: "PUBLISHED" as WebsitePageStatus,
    excerpt: "Curriculum and academic programs",
    content: "Explore our academic programs.",
    sortOrder: 4,
  },
  {
    title: "Contact",
    slug: "/contact",
    menuKey: "FOOTER",
    status: "DRAFT" as WebsitePageStatus,
    excerpt: "Contact details",
    content: "Get in touch with us.",
    sortOrder: 5,
  },
  {
    title: "Gallery",
    slug: "/gallery",
    menuKey: "FOOTER",
    status: "DRAFT" as WebsitePageStatus,
    excerpt: "Photo gallery",
    content: "Campus life gallery.",
    sortOrder: 6,
  },
];

function normalizeSlug(input: string) {
  const raw = input.trim().toLowerCase();
  if (!raw || raw === "/") return "/";
  const cleaned = raw
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^-|-$/g, "");
  return `/${cleaned}`;
}

function formatUpdatedAt(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

async function ensureDefaults(tenantId: string) {
  const [pageCount, menuCount, setting] = await Promise.all([
    prisma.websitePage.count({ where: { tenantId } }),
    prisma.websiteMenu.count({ where: { tenantId } }),
    prisma.tenantWebsiteSetting.findUnique({ where: { tenantId } }),
  ]);

  if (menuCount === 0) {
    await prisma.websiteMenu.createMany({
      data: DEFAULT_MENUS.map((item) => ({ tenantId, ...item, isActive: true })),
    });
  }

  if (pageCount === 0) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    await prisma.websitePage.createMany({
      data: DEFAULT_PAGES.map((item) => ({
        tenantId,
        title: item.title,
        slug: item.slug,
        menuKey: item.menuKey,
        status: item.status,
        excerpt: item.excerpt,
        content: item.content,
        sortOrder: item.sortOrder,
        seoTitle: `${item.title} | ${tenant?.name ?? "School"}`,
        seoDescription: item.excerpt,
        publishedAt: item.status === "PUBLISHED" ? new Date() : null,
      })),
    });

    const menus = await prisma.websiteMenu.findMany({ where: { tenantId } });
    const pages = await prisma.websitePage.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });
    const menuByKey = new Map(menus.map((m) => [m.key, m]));
    for (const page of pages) {
      if (page.menuKey === "NONE") continue;
      const menu = menuByKey.get(page.menuKey);
      if (!menu) continue;
      await prisma.websiteMenuItem.create({
        data: {
          menuId: menu.id,
          pageId: page.id,
          label: page.title,
          url: page.slug,
          sortOrder: page.sortOrder,
          isActive: page.status === "PUBLISHED",
        },
      });
    }
  }

  if (!setting) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    await prisma.tenantWebsiteSetting.create({
      data: {
        tenantId,
        siteTitle: tenant?.name ?? "School Website",
        siteTagline: "Excellence in Education",
        defaultSeoTitle: `${tenant?.name ?? "School"} | Official Website`,
        defaultSeoDesc: "Official school website for admissions, academics, and notices.",
        maintenanceMode: false,
      },
    });
  }
}

export async function getWebsiteCmsSetup(tenantId: string) {
  await ensureDefaults(tenantId);

  const [pages, menus, media, banners, siteSettings] = await Promise.all([
    prisma.websitePage.findMany({
      where: { tenantId },
      include: {
        updatedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    prisma.websiteMenu.findMany({
      where: { tenantId },
      include: {
        items: {
          include: { page: { select: { id: true, title: true, slug: true } } },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { items: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.websiteMediaAsset.findMany({
      where: { tenantId },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.websiteBanner.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tenantWebsiteSetting.findUnique({ where: { tenantId } }),
  ]);

  const published = pages.filter((p) => p.status === "PUBLISHED").length;
  const drafts = pages.filter((p) => p.status === "DRAFT").length;

  return {
    pages: pages.map((page, index) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      excerpt: page.excerpt,
      content: page.content,
      menuKey: page.menuKey,
      menuLabel: MENU_LABELS[page.menuKey] ?? page.menuKey,
      status: page.status,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      sortOrder: page.sortOrder,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
      updatedAtLabel: formatUpdatedAt(page.updatedAt),
      updatedByName: page.updatedBy
        ? `${page.updatedBy.firstName} ${page.updatedBy.lastName ?? ""}`.trim() ||
          page.updatedBy.email
        : "System",
      index: index + 1,
    })),
    menus: menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      key: menu.key,
      isActive: menu.isActive,
      sortOrder: menu.sortOrder,
      itemCount: menu._count.items,
      items: menu.items.map((item) => ({
        id: item.id,
        label: item.label,
        url: item.url,
        pageId: item.pageId,
        pageTitle: item.page?.title ?? null,
        isActive: item.isActive,
        sortOrder: item.sortOrder,
      })),
    })),
    media: media.map((item) => ({
      id: item.id,
      name: item.name,
      fileUrl: item.fileUrl,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt,
      uploadedByName: item.uploadedBy
        ? `${item.uploadedBy.firstName} ${item.uploadedBy.lastName ?? ""}`.trim()
        : "System",
    })),
    banners: banners.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      imageUrl: item.imageUrl,
      linkUrl: item.linkUrl,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    })),
    siteSettings: {
      siteTitle: siteSettings?.siteTitle ?? "",
      siteTagline: siteSettings?.siteTagline ?? "",
      defaultSeoTitle: siteSettings?.defaultSeoTitle ?? "",
      defaultSeoDesc: siteSettings?.defaultSeoDesc ?? "",
      contactEmail: siteSettings?.contactEmail ?? "",
      contactPhone: siteSettings?.contactPhone ?? "",
      socialFacebook: siteSettings?.socialFacebook ?? "",
      socialInstagram: siteSettings?.socialInstagram ?? "",
      socialYoutube: siteSettings?.socialYoutube ?? "",
      googleAnalyticsId: siteSettings?.googleAnalyticsId ?? "",
      homepagePageId: siteSettings?.homepagePageId ?? null,
      maintenanceMode: siteSettings?.maintenanceMode ?? false,
    },
    menuOptions: Object.entries(MENU_LABELS)
      .filter(([key]) => key !== "NONE")
      .map(([key, label]) => ({ key, label }))
      .concat([{ key: "NONE", label: "No Menu" }]),
    stats: {
      totalPages: pages.length,
      publishedPages: published,
      draftPages: drafts,
      menus: menus.filter((m) => m.isActive).length,
      mediaFiles: media.length,
      banners: banners.length,
    },
  };
}

export type PageInput = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  menuKey?: string;
  status?: WebsitePageStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export async function createWebsitePage(tenantId: string, userId: string, input: PageInput) {
  const title = input.title.trim();
  const slug = normalizeSlug(input.slug || title);
  const exists = await prisma.websitePage.findFirst({
    where: tenantScope(tenantId, { slug }),
  });
  if (exists) throw new AppError(409, `Slug "${slug}" already exists`, "PAGE_SLUG_EXISTS");

  const maxSort = await prisma.websitePage.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });
  const status = input.status ?? "DRAFT";

  await prisma.websitePage.create({
    data: {
      tenantId,
      title,
      slug,
      excerpt: input.excerpt?.trim() || null,
      content: input.content?.trim() || null,
      menuKey: input.menuKey ?? "NONE",
      status,
      seoTitle: input.seoTitle?.trim() || title,
      seoDescription: input.seoDescription?.trim() || input.excerpt?.trim() || null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      updatedById: userId,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  return getWebsiteCmsSetup(tenantId);
}

export async function updateWebsitePage(
  tenantId: string,
  userId: string,
  id: string,
  input: Partial<PageInput>,
) {
  const found = await prisma.websitePage.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Page not found", "PAGE_NOT_FOUND");

  const slug = input.slug !== undefined ? normalizeSlug(input.slug) : found.slug;
  if (slug !== found.slug) {
    const exists = await prisma.websitePage.findFirst({
      where: tenantScope(tenantId, { slug, id: { not: id } }),
    });
    if (exists) throw new AppError(409, `Slug "${slug}" already exists`, "PAGE_SLUG_EXISTS");
  }

  const status = input.status ?? found.status;

  await prisma.websitePage.update({
    where: { id },
    data: {
      ...(input.title != null ? { title: input.title.trim() } : {}),
      ...(input.slug !== undefined ? { slug } : {}),
      ...(input.excerpt !== undefined ? { excerpt: input.excerpt?.trim() || null } : {}),
      ...(input.content !== undefined ? { content: input.content?.trim() || null } : {}),
      ...(input.menuKey !== undefined ? { menuKey: input.menuKey } : {}),
      ...(input.status !== undefined ? { status } : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle?.trim() || null } : {}),
      ...(input.seoDescription !== undefined
        ? { seoDescription: input.seoDescription?.trim() || null }
        : {}),
      updatedById: userId,
      ...(status === "PUBLISHED" && !found.publishedAt ? { publishedAt: new Date() } : {}),
      ...(status === "DRAFT" ? { publishedAt: null } : {}),
    },
  });

  return getWebsiteCmsSetup(tenantId);
}

export async function deleteWebsitePage(tenantId: string, id: string) {
  const found = await prisma.websitePage.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Page not found", "PAGE_NOT_FOUND");
  await prisma.websitePage.delete({ where: { id } });
  return getWebsiteCmsSetup(tenantId);
}

export async function upsertWebsiteMenu(
  tenantId: string,
  input: { id?: string; name: string; key: string; isActive?: boolean },
) {
  const key = input.key.trim().toUpperCase().replace(/\s+/g, "_");
  if (input.id) {
    const found = await prisma.websiteMenu.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Menu not found", "MENU_NOT_FOUND");
    await prisma.websiteMenu.update({
      where: { id: input.id },
      data: {
        name: input.name.trim(),
        key,
        isActive: input.isActive ?? found.isActive,
      },
    });
  } else {
    const exists = await prisma.websiteMenu.findFirst({ where: tenantScope(tenantId, { key }) });
    if (exists) throw new AppError(409, "Menu key already exists", "MENU_EXISTS");
    const maxSort = await prisma.websiteMenu.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    await prisma.websiteMenu.create({
      data: {
        tenantId,
        name: input.name.trim(),
        key,
        isActive: input.isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }
  return getWebsiteCmsSetup(tenantId);
}

export async function deleteWebsiteMenu(tenantId: string, id: string) {
  const found = await prisma.websiteMenu.findFirst({ where: tenantScope(tenantId, { id }) });
  if (!found) throw new AppError(404, "Menu not found", "MENU_NOT_FOUND");
  await prisma.websiteMenu.delete({ where: { id } });
  return getWebsiteCmsSetup(tenantId);
}

export async function upsertWebsiteMenuItem(
  tenantId: string,
  input: {
    id?: string;
    menuId: string;
    label: string;
    url?: string | null;
    pageId?: string | null;
    isActive?: boolean;
  },
) {
  const menu = await prisma.websiteMenu.findFirst({
    where: tenantScope(tenantId, { id: input.menuId }),
  });
  if (!menu) throw new AppError(404, "Menu not found", "MENU_NOT_FOUND");

  if (input.id) {
    const found = await prisma.websiteMenuItem.findFirst({
      where: { id: input.id, menuId: menu.id },
    });
    if (!found) throw new AppError(404, "Menu item not found", "MENU_ITEM_NOT_FOUND");
    await prisma.websiteMenuItem.update({
      where: { id: input.id },
      data: {
        label: input.label.trim(),
        url: input.url?.trim() || null,
        pageId: input.pageId ?? null,
        isActive: input.isActive ?? found.isActive,
      },
    });
  } else {
    const maxSort = await prisma.websiteMenuItem.aggregate({
      where: { menuId: menu.id },
      _max: { sortOrder: true },
    });
    await prisma.websiteMenuItem.create({
      data: {
        menuId: menu.id,
        label: input.label.trim(),
        url: input.url?.trim() || null,
        pageId: input.pageId ?? null,
        isActive: input.isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }
  return getWebsiteCmsSetup(tenantId);
}

export async function deleteWebsiteMenuItem(tenantId: string, id: string) {
  const found = await prisma.websiteMenuItem.findFirst({
    where: { id, menu: { tenantId } },
  });
  if (!found) throw new AppError(404, "Menu item not found", "MENU_ITEM_NOT_FOUND");
  await prisma.websiteMenuItem.delete({ where: { id } });
  return getWebsiteCmsSetup(tenantId);
}

export async function createWebsiteMedia(
  tenantId: string,
  userId: string,
  input: { name: string; fileUrl: string; mimeType?: string | null; sizeBytes?: number | null },
) {
  await prisma.websiteMediaAsset.create({
    data: {
      tenantId,
      name: input.name.trim(),
      fileUrl: input.fileUrl,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      uploadedById: userId,
    },
  });
  return getWebsiteCmsSetup(tenantId);
}

export async function deleteWebsiteMedia(tenantId: string, id: string) {
  const found = await prisma.websiteMediaAsset.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Media not found", "MEDIA_NOT_FOUND");
  await prisma.websiteMediaAsset.delete({ where: { id } });
  return getWebsiteCmsSetup(tenantId);
}

export async function upsertWebsiteBanner(
  tenantId: string,
  input: {
    id?: string;
    title: string;
    subtitle?: string | null;
    imageUrl?: string | null;
    linkUrl?: string | null;
    isActive?: boolean;
  },
) {
  if (input.id) {
    const found = await prisma.websiteBanner.findFirst({
      where: tenantScope(tenantId, { id: input.id }),
    });
    if (!found) throw new AppError(404, "Banner not found", "BANNER_NOT_FOUND");
    await prisma.websiteBanner.update({
      where: { id: input.id },
      data: {
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || null,
        imageUrl: input.imageUrl || null,
        linkUrl: input.linkUrl?.trim() || null,
        isActive: input.isActive ?? found.isActive,
      },
    });
  } else {
    const maxSort = await prisma.websiteBanner.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    await prisma.websiteBanner.create({
      data: {
        tenantId,
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || null,
        imageUrl: input.imageUrl || null,
        linkUrl: input.linkUrl?.trim() || null,
        isActive: input.isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
  }
  return getWebsiteCmsSetup(tenantId);
}

export async function deleteWebsiteBanner(tenantId: string, id: string) {
  const found = await prisma.websiteBanner.findFirst({
    where: tenantScope(tenantId, { id }),
  });
  if (!found) throw new AppError(404, "Banner not found", "BANNER_NOT_FOUND");
  await prisma.websiteBanner.delete({ where: { id } });
  return getWebsiteCmsSetup(tenantId);
}

export async function saveWebsiteSiteSettings(
  tenantId: string,
  input: {
    siteTitle?: string | null;
    siteTagline?: string | null;
    defaultSeoTitle?: string | null;
    defaultSeoDesc?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    socialFacebook?: string | null;
    socialInstagram?: string | null;
    socialYoutube?: string | null;
    googleAnalyticsId?: string | null;
    homepagePageId?: string | null;
    maintenanceMode?: boolean;
  },
) {
  await prisma.tenantWebsiteSetting.upsert({
    where: { tenantId },
    create: {
      tenantId,
      siteTitle: input.siteTitle?.trim() || null,
      siteTagline: input.siteTagline?.trim() || null,
      defaultSeoTitle: input.defaultSeoTitle?.trim() || null,
      defaultSeoDesc: input.defaultSeoDesc?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      socialFacebook: input.socialFacebook?.trim() || null,
      socialInstagram: input.socialInstagram?.trim() || null,
      socialYoutube: input.socialYoutube?.trim() || null,
      googleAnalyticsId: input.googleAnalyticsId?.trim() || null,
      homepagePageId: input.homepagePageId || null,
      maintenanceMode: input.maintenanceMode ?? false,
    },
    update: {
      ...(input.siteTitle !== undefined ? { siteTitle: input.siteTitle?.trim() || null } : {}),
      ...(input.siteTagline !== undefined
        ? { siteTagline: input.siteTagline?.trim() || null }
        : {}),
      ...(input.defaultSeoTitle !== undefined
        ? { defaultSeoTitle: input.defaultSeoTitle?.trim() || null }
        : {}),
      ...(input.defaultSeoDesc !== undefined
        ? { defaultSeoDesc: input.defaultSeoDesc?.trim() || null }
        : {}),
      ...(input.contactEmail !== undefined
        ? { contactEmail: input.contactEmail?.trim() || null }
        : {}),
      ...(input.contactPhone !== undefined
        ? { contactPhone: input.contactPhone?.trim() || null }
        : {}),
      ...(input.socialFacebook !== undefined
        ? { socialFacebook: input.socialFacebook?.trim() || null }
        : {}),
      ...(input.socialInstagram !== undefined
        ? { socialInstagram: input.socialInstagram?.trim() || null }
        : {}),
      ...(input.socialYoutube !== undefined
        ? { socialYoutube: input.socialYoutube?.trim() || null }
        : {}),
      ...(input.googleAnalyticsId !== undefined
        ? { googleAnalyticsId: input.googleAnalyticsId?.trim() || null }
        : {}),
      ...(input.homepagePageId !== undefined
        ? { homepagePageId: input.homepagePageId || null }
        : {}),
      ...(input.maintenanceMode !== undefined
        ? { maintenanceMode: input.maintenanceMode }
        : {}),
    },
  });
  return getWebsiteCmsSetup(tenantId);
}
