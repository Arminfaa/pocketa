import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2).max(60).trim(),
  email: z.string().email().max(120).trim(),
  password: z.string().min(8).max(200),
});

export const LoginSchema = z.object({
  email: z.string().email().max(120).trim(),
  password: z.string().min(1).max(200),
});
