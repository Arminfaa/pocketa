import { z } from "zod";

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(60).trim().optional(),
  avatar: z.string().url().optional().nullable(),
});
