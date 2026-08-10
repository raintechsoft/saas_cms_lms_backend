-- CreateEnum
CREATE TYPE "WebsitePageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "website_pages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT,
    "menu_key" TEXT NOT NULL DEFAULT 'NONE',
    "status" "WebsitePageStatus" NOT NULL DEFAULT 'DRAFT',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_menus" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_menu_items" (
    "id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "page_id" TEXT,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_media_assets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_banners" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "image_url" TEXT,
    "link_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_website_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_title" TEXT,
    "site_tagline" TEXT,
    "default_seo_title" TEXT,
    "default_seo_desc" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "social_facebook" TEXT,
    "social_instagram" TEXT,
    "social_youtube" TEXT,
    "google_analytics_id" TEXT,
    "homepage_page_id" TEXT,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_website_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_pages_tenant_id_status_sort_order_idx" ON "website_pages"("tenant_id", "status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "website_pages_tenant_id_slug_key" ON "website_pages"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "website_menus_tenant_id_is_active_idx" ON "website_menus"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "website_menus_tenant_id_key_key" ON "website_menus"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "website_menu_items_menu_id_sort_order_idx" ON "website_menu_items"("menu_id", "sort_order");

-- CreateIndex
CREATE INDEX "website_media_assets_tenant_id_created_at_idx" ON "website_media_assets"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "website_banners_tenant_id_is_active_sort_order_idx" ON "website_banners"("tenant_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_website_settings_tenant_id_key" ON "tenant_website_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_menus" ADD CONSTRAINT "website_menus_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_menu_items" ADD CONSTRAINT "website_menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "website_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_menu_items" ADD CONSTRAINT "website_menu_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "website_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_media_assets" ADD CONSTRAINT "website_media_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_media_assets" ADD CONSTRAINT "website_media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_banners" ADD CONSTRAINT "website_banners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_website_settings" ADD CONSTRAINT "tenant_website_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
