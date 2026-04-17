import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// POST /salespersons
// ─────────────────────────────────────────────────────────────────────────────
export const CreateSalespersonRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  department: z.string().max(100).optional(),
  manager_id: z.number().int().positive(),
  is_manager: z.boolean(),
});

export type CreateSalespersonRequest = z.infer<
  typeof CreateSalespersonRequestSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// PUT /salespersons/{salesperson_id}（password を除く）
// ─────────────────────────────────────────────────────────────────────────────
export const UpdateSalespersonRequestSchema =
  CreateSalespersonRequestSchema.omit({ password: true });

export type UpdateSalespersonRequest = z.infer<
  typeof UpdateSalespersonRequestSchema
>;

// ─────────────────────────────────────────────────────────────────────────────
// GET /salespersons クエリパラメータ
// ─────────────────────────────────────────────────────────────────────────────
export const SalespersonListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type SalespersonListQuery = z.infer<typeof SalespersonListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 営業レスポンス
// ─────────────────────────────────────────────────────────────────────────────
export const SalespersonResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().email(),
  department: z.string().nullable(),
  is_manager: z.boolean(),
  manager_id: z.number().int().nullable(),
  manager_name: z.string().nullable(),
});

export type SalespersonResponse = z.infer<typeof SalespersonResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST/PUT /salespersons レスポンス（作成・更新確認用）
// ─────────────────────────────────────────────────────────────────────────────
export const SalespersonMutationResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string().email(),
});

export type SalespersonMutationResponse = z.infer<
  typeof SalespersonMutationResponseSchema
>;
