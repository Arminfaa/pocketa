import path from "path";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),

  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  // Production uses Vercel → same-origin /api rewrite → Render, so cookies are
  // first-party. Prefer "lax" (iOS Home Screen PWAs drop SameSite=None aggressively).
  // Use "none" only if the browser talks to the API on a different site.
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

  VAPID_PUBLIC_KEY: z.string().optional().default(""),
  VAPID_PRIVATE_KEY: z.string().optional().default(""),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@pocketa.local"),

  // GoldAPI — https://www.goldapi.io (daily cache in MongoDB)
  GOLD_API_KEY: z.string().optional().default(""),

  // Navasan — http://api.navasan.tech (daily cache, refresh ~14:00 Tehran)
  NAVASAN_API_KEY: z.string().optional().default(""),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

export function isWebPushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}
