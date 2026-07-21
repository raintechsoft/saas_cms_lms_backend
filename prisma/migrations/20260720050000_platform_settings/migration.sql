-- CreateTable
CREATE TABLE `platform_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'platform',
    `branding` JSON NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
