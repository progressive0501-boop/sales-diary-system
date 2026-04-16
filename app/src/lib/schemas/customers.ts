import { z } from "zod";

// 電話番号フォーマット（ハイフンあり・なし両対応）
const phoneSchema = z
  .string()
  .regex(/^\d{2,4}-?\d{2,4}-?\d{4}$/, {
    message: "電話番号の形式が正しくありません",
  })
  .optional();

// ─────────────────────────────────────────────────────────────────────────────
// POST /customers
// ─────────────────────────────────────────────────────────────────────────────
export const CreateCustomerRequestSchema = z.object({
  name: z.string().min(1).max(100),
  company: z.string().min(1).max(200),
  phone: phoneSchema,
  address: z.string().max(300).optional(),
  assigned_salesperson_id: z.number().int().positive(),
});

export type CreateCustomerRequest = z.infer<typeof CreateCustomerRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PUT /customers/{customer_id}
// ─────────────────────────────────────────────────────────────────────────────
export const UpdateCustomerRequestSchema = CreateCustomerRequestSchema;

export type UpdateCustomerRequest = z.infer<typeof UpdateCustomerRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// GET /customers クエリパラメータ
// ─────────────────────────────────────────────────────────────────────────────
export const CustomerListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 顧客レスポンス
// ─────────────────────────────────────────────────────────────────────────────
export const CustomerResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  company: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  assigned_salesperson_id: z.number().int(),
  assigned_salesperson_name: z.string(),
});

export type CustomerResponse = z.infer<typeof CustomerResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST/PUT /customers レスポンス（作成・更新確認用）
// ─────────────────────────────────────────────────────────────────────────────
export const CustomerMutationResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  company: z.string(),
});

export type CustomerMutationResponse = z.infer<
  typeof CustomerMutationResponseSchema
>;
