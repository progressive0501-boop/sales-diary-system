import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────────────────────────────────────
export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginUserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().email(),
  is_manager: z.boolean(),
});

export type LoginUser = z.infer<typeof LoginUserSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  expires_at: z.string().datetime(),
  user: LoginUserSchema,
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────────────────────────────────────
export const LogoutResponseSchema = z.object({
  success: z.literal(true),
  data: z.null(),
});

export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
