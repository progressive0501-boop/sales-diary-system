import { describe, test, expect } from "vitest";
import { PaginationQuerySchema } from "../common";

describe("PaginationQuerySchema", () => {
  test("デフォルト値が正しく適用される", () => {
    const result = PaginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.per_page).toBe(20);
    }
  });

  test("文字列の数値を数値型に変換する", () => {
    const result = PaginationQuerySchema.safeParse({
      page: "2",
      per_page: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.per_page).toBe(50);
    }
  });

  test("pageが0でエラーになる", () => {
    const result = PaginationQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  test("per_pageが101でエラーになる", () => {
    const result = PaginationQuerySchema.safeParse({ per_page: 101 });
    expect(result.success).toBe(false);
  });

  test("per_pageが100で成功する（上限境界値）", () => {
    const result = PaginationQuerySchema.safeParse({ per_page: 100 });
    expect(result.success).toBe(true);
  });
});
