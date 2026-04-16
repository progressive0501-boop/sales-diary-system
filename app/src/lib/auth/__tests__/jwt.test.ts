// @vitest-environment node
import { describe, test, expect, beforeAll } from "vitest";
import { signToken, verifyToken } from "../jwt";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-that-is-32-chars-long";
});

const testPayload = {
  sub: "1",
  name: "山田 太郎",
  email: "yamada@example.co.jp",
  is_manager: false,
};

describe("signToken", () => {
  test("JWT文字列を生成する", async () => {
    const token = await signToken(testPayload);
    expect(typeof token).toBe("string");
    // JWTは3つのBase64パートをピリオドで区切った形式
    expect(token.split(".")).toHaveLength(3);
  });

  test("上長フラグがtrueでもトークンを生成できる", async () => {
    const token = await signToken({ ...testPayload, is_manager: true });
    expect(typeof token).toBe("string");
  });
});

describe("verifyToken", () => {
  test("有効なトークンを検証してペイロードを返す", async () => {
    const token = await signToken(testPayload);
    const payload = await verifyToken(token);

    expect(payload.sub).toBe(testPayload.sub);
    expect(payload.name).toBe(testPayload.name);
    expect(payload.email).toBe(testPayload.email);
    expect(payload.is_manager).toBe(testPayload.is_manager);
  });

  test("改ざんされたトークンでエラーになる", async () => {
    const token = await signToken(testPayload);
    const tampered = token.slice(0, -5) + "AAAAA";
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  test("不正なトークン文字列でエラーになる", async () => {
    await expect(verifyToken("invalid.token.here")).rejects.toThrow();
  });

  test("JWT_SECRETが未設定の場合エラーになる", async () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      await expect(signToken(testPayload)).rejects.toThrow(
        "JWT_SECRET environment variable is not set",
      );
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });
});
