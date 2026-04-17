import { describe, test, expect } from "vitest";
import { CreateCommentRequestSchema } from "../comments";

describe("CreateCommentRequestSchema", () => {
  test("target_type=problemで成功する", () => {
    const result = CreateCommentRequestSchema.safeParse({
      target_type: "problem",
      content: "見積もりは標準条件で対応してください。",
    });
    expect(result.success).toBe(true);
  });

  test("target_type=planで成功する", () => {
    const result = CreateCommentRequestSchema.safeParse({
      target_type: "plan",
      content: "対応計画を確認しました。",
    });
    expect(result.success).toBe(true);
  });

  test("不正なtarget_typeでエラーになる", () => {
    const result = CreateCommentRequestSchema.safeParse({
      target_type: "other",
      content: "コメント内容",
    });
    expect(result.success).toBe(false);
  });

  test("contentが空文字でエラーになる", () => {
    const result = CreateCommentRequestSchema.safeParse({
      target_type: "problem",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  test("contentが2001文字でエラーになる", () => {
    const result = CreateCommentRequestSchema.safeParse({
      target_type: "plan",
      content: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
