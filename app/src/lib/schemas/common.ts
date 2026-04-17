import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// ページネーションクエリ
// ─────────────────────────────────────────────────────────────────────────────
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ページネーション情報（レスポンス）
// ─────────────────────────────────────────────────────────────────────────────
export const PaginationSchema = z.object({
  total: z.number().int(),
  total_pages: z.number().int(),
  current_page: z.number().int(),
  per_page: z.number().int(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 共通 API レスポンス
// ─────────────────────────────────────────────────────────────────────────────
export const ApiErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export const ApiErrorSchema = z.object({
  code: z.enum([
    "VALIDATION_ERROR",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "INTERNAL_ERROR",
  ]),
  message: z.string(),
  details: z.array(ApiErrorDetailSchema).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export function ApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), data: dataSchema }),
    z.object({ success: z.literal(false), error: ApiErrorSchema }),
  ]);
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

export function PaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
) {
  return z.object({
    items: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}

export type PaginatedResponse<T> = {
  items: T[];
  pagination: Pagination;
};
