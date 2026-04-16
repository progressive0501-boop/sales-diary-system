import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// 訪問記録（POST/PUT リクエスト内のネストオブジェクト）
// ─────────────────────────────────────────────────────────────────────────────
export const VisitRecordInputSchema = z.object({
  customer_id: z.number().int().positive(),
  visit_content: z.string().min(1).max(1000),
  visit_order: z.number().int().min(1),
});

export type VisitRecordInput = z.infer<typeof VisitRecordInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST /reports
// ─────────────────────────────────────────────────────────────────────────────
export const CreateReportRequestSchema = z.object({
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "YYYY-MM-DD 形式で入力してください",
  }),
  problem: z.string().max(2000).optional(),
  plan: z.string().max(2000).optional(),
  visit_records: z.array(VisitRecordInputSchema).min(1),
});

export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PUT /reports/{report_id}
// ─────────────────────────────────────────────────────────────────────────────
export const UpdateReportRequestSchema = CreateReportRequestSchema;

export type UpdateReportRequest = z.infer<typeof UpdateReportRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// GET /reports クエリパラメータ
// ─────────────────────────────────────────────────────────────────────────────
export const ReportListQuerySchema = z.object({
  salesperson_id: z.coerce.number().int().positive().optional(),
  year_month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, { message: "YYYY-MM 形式で入力してください" })
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReportListQuery = z.infer<typeof ReportListQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 訪問記録レスポンス
// ─────────────────────────────────────────────────────────────────────────────
export const VisitRecordResponseSchema = z.object({
  id: z.number().int(),
  customer_id: z.number().int(),
  customer_name: z.string(),
  customer_company: z.string(),
  visit_content: z.string(),
  visit_order: z.number().int(),
});

export type VisitRecordResponse = z.infer<typeof VisitRecordResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 日報レスポンス（一覧アイテム）
// ─────────────────────────────────────────────────────────────────────────────
export const ReportListItemSchema = z.object({
  id: z.number().int(),
  salesperson_id: z.number().int(),
  salesperson_name: z.string(),
  report_date: z.string(),
  visit_count: z.number().int(),
  has_comment: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ReportListItem = z.infer<typeof ReportListItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 日報レスポンス（詳細）
// ─────────────────────────────────────────────────────────────────────────────
export const ReportResponseSchema = z.object({
  id: z.number().int(),
  salesperson_id: z.number().int(),
  salesperson_name: z.string(),
  report_date: z.string(),
  problem: z.string().nullable(),
  plan: z.string().nullable(),
  visit_records: z.array(VisitRecordResponseSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ReportResponse = z.infer<typeof ReportResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST /reports レスポンス（作成確認用）
// ─────────────────────────────────────────────────────────────────────────────
export const CreateReportResponseSchema = z.object({
  id: z.number().int(),
  report_date: z.string(),
});

export type CreateReportResponse = z.infer<typeof CreateReportResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PUT /reports/{report_id} レスポンス（更新確認用）
// ─────────────────────────────────────────────────────────────────────────────
export const UpdateReportResponseSchema = z.object({
  id: z.number().int(),
  report_date: z.string(),
  updated_at: z.string().datetime(),
});

export type UpdateReportResponse = z.infer<typeof UpdateReportResponseSchema>;
