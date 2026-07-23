import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

export const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
export const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function createS3Client() {
  if (env.STORAGE_DRIVER !== "s3") return null;
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

const s3 = createS3Client();

export function isS3Configured() {
  return env.STORAGE_DRIVER === "s3" && Boolean(s3);
}

export function getStorageDriver() {
  return env.STORAGE_DRIVER;
}

export async function ensureLocalUploadDirs() {
  if (env.STORAGE_DRIVER !== "local") return;
  await fs.mkdir(AVATAR_DIR, { recursive: true });
}

function buildAvatarFilename(originalName: string) {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const safeExt = ALLOWED_EXT.has(ext) ? ext : ".jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
}

function publicLocalPath(filename: string) {
  return `/uploads/avatars/${filename}`;
}

function publicS3Url(key: string) {
  if (env.S3_PUBLIC_BASE_URL) {
    return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }
  if (env.S3_ENDPOINT) {
    const base = env.S3_ENDPOINT.replace(/\/$/, "");
    if (env.S3_FORCE_PATH_STYLE) {
      return `${base}/${env.S3_BUCKET}/${key}`;
    }
    const host = new URL(base).host;
    return `https://${env.S3_BUCKET}.${host}/${key}`;
  }
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

/** Multer middleware — keeps file in memory so local disk or S3 can both consume it. */
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

/** Persist an uploaded avatar and return the public URL stored on the user record. */
export async function persistAvatarUpload(file: Express.Multer.File) {
  if (!file.buffer?.length) {
    throw new AppError(400, "Image file is required", "FILE_REQUIRED");
  }

  const filename = buildAvatarFilename(file.originalname);
  const key = `avatars/${filename}`;

  if (env.STORAGE_DRIVER === "s3") {
    if (!s3 || !env.S3_BUCKET) {
      throw new AppError(503, "S3 storage is not configured", "STORAGE_NOT_CONFIGURED");
    }

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "S3 upload failed";
      console.error(`[storage] S3 upload failed: ${message}`);
      throw new AppError(502, "Failed to upload file to storage", "STORAGE_UPLOAD_FAILED");
    }

    const url = publicS3Url(key);
    console.info(`[storage] Uploaded to S3 key=${key}`);
    return url;
  }

  await ensureLocalUploadDirs();
  await fs.writeFile(path.join(AVATAR_DIR, filename), file.buffer);
  return publicLocalPath(filename);
}

export async function verifyStorageConnection() {
  if (env.STORAGE_DRIVER === "local") {
    await ensureLocalUploadDirs();
    return { ok: true as const, driver: "local" as const, detail: AVATAR_DIR };
  }

  if (!s3 || !env.S3_BUCKET) {
    return { ok: false as const, driver: "s3" as const, reason: "S3 client is not configured" };
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return {
      ok: true as const,
      driver: "s3" as const,
      detail: env.S3_PUBLIC_BASE_URL || `s3://${env.S3_BUCKET}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "S3 HeadBucket failed";
    return { ok: false as const, driver: "s3" as const, reason: message };
  }
}
