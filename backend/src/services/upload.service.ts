import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import path from "path";
import { env, isCloudinaryConfigured } from "../config/env";
import { AppError } from "../utils/AppError";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || undefined,
  api_key: env.CLOUDINARY_API_KEY || undefined,
  api_secret: env.CLOUDINARY_API_SECRET || undefined,
  secure: true,
});

export type UploadedImage = {
  url: string;
  publicId?: string;
  provider: "cloudinary" | "local";
};

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

async function uploadToCloudinary(filePath: string, folder: string): Promise<UploadedImage> {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: `pocketa/${folder}`,
    resource_type: "image",
    overwrite: true,
    transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    provider: "cloudinary",
  };
}

async function uploadLocally(filePath: string, originalName: string): Promise<UploadedImage> {
  await ensureUploadsDir();
  const ext = path.extname(originalName) || ".jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const dest = path.join(UPLOADS_DIR, filename);
  await fs.copyFile(filePath, dest);

  const base = `http://localhost:${env.PORT}`;
  return {
    url: `${base}/uploads/${filename}`,
    provider: "local",
  };
}

/**
 * Production → Cloudinary (required).
 * Development → Cloudinary if configured, otherwise local /uploads.
 * @see https://cloudinary.com/
 */
export async function uploadImage(
  filePath: string,
  originalName: string,
  folder = "avatars"
): Promise<UploadedImage> {
  const useCloudinary = isCloudinaryConfigured();

  if (env.NODE_ENV === "production" && !useCloudinary) {
    throw new AppError(
      500,
      "در production باید Cloudinary تنظیم شود (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)"
    );
  }

  try {
    if (useCloudinary) {
      return await uploadToCloudinary(filePath, folder);
    }
    return await uploadLocally(filePath, originalName);
  } finally {
    await fs.unlink(filePath).catch(() => undefined);
  }
}
