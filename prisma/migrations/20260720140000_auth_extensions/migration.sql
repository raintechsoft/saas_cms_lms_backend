-- AlterTable
ALTER TABLE `users` MODIFY `password_hash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `google_subject_id` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_google_subject_id_key` ON `users`(`google_subject_id`);

-- CreateTable
CREATE TABLE `auth_verifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `purpose` ENUM('LOGIN_OTP', 'PASSWORD_RESET') NOT NULL,
    `code_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auth_verifications_user_id_purpose_idx`(`user_id`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auth_verifications` ADD CONSTRAINT `auth_verifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
