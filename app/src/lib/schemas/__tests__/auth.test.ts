import { describe, test, expect } from "vitest";
import { LoginRequestSchema } from "../auth";

describe("LoginRequestSchema", () => {
  test("有効なメールとパスワードで成功する", () => {
    const result = LoginRequestSchema.safeParse({
      email: "yamada@example.co.jp",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  test("不正なメール形式でエラーになる", () => {
    const result = LoginRequestSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  test("パスワードが空文字でエラーになる", () => {
    const result = LoginRequestSchema.safeParse({
      email: "yamada@example.co.jp",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  test("emailが未指定でエラーになる", () => {
    const result = LoginRequestSchema.safeParse({ password: "password123" });
    expect(result.success).toBe(false);
  });
});
