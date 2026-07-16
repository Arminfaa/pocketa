import multer from "multer";
import path from "path";
import os from "os";
import { AppError } from "../utils/AppError";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `pocketa-${Date.now()}${ext}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new AppError(400, "فقط فایل‌های تصویری JPEG/PNG/WebP/GIF مجاز هستند") as unknown as Error);
      return;
    }
    cb(null, true);
  },
});
