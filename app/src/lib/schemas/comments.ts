import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// POST /reports/{report_id}/comments
// ─────────────────────────────────────────────────────────────────────────────
export const CreateCommentRequestSchema = z.object({
  target_type: z.enum(["problem", "plan"]),
  content: z.string().min(1).max(2000),
});

export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// コメントレスポンス
// ─────────────────────────────────────────────────────────────────────────────
export const CommentResponseSchema = z.object({
  id: z.number().int(),
  report_id: z.number().int(),
  target_type: z.enum(["problem", "plan"]),
  commenter_id: z.number().int(),
  commenter_name: z.string(),
  content: z.string(),
  created_at: z.string().datetime(),
});

export type CommentResponse = z.infer<typeof CommentResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// GET /reports/{report_id}/comments レスポンス
// ─────────────────────────────────────────────────────────────────────────────
export const CommentsGroupedResponseSchema = z.object({
  problem: z.array(CommentResponseSchema),
  plan: z.array(CommentResponseSchema),
});

export type CommentsGroupedResponse = z.infer<
  typeof CommentsGroupedResponseSchema
>;
