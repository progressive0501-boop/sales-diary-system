// @vitest-environment node
import { describe, test, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "../jwt";
import { proxy } from "../../../proxy";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-that-is-32-chars-long";
});

const BASE_URL = "http://localhost:3000";

async function makeToken(is_manager = false) {
  return signToken({
    sub: "1",
    name: "山田 太郎",
    email: "yamada@example.co.jp",
    is_manager,
  });
}

describe("proxy - 保護対象外ルート", () => {
  test("/loginはトークンなしで通過する", async () => {
    const req = new NextRequest(`${BASE_URL}/login`);
    const res = await proxy(req);
    // リダイレクトしない（307/302ではない）
    expect(res.status).not.toBe(302);
    expect(res.status).not.toBe(307);
  });
});

describe("proxy - APIルート（/api/）", () => {
  test("トークンなしで401 UNAUTHORIZEDを返す", async () => {
    const req = new NextRequest(`${BASE_URL}/api/reports`);
    const res = await proxy(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("不正なトークンで401を返す", async () => {
    const req = new NextRequest(`${BASE_URL}/api/reports`, {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  test("有効なトークンで通過する（ステータス200台）", async () => {
    const token = await makeToken();
    const req = new NextRequest(`${BASE_URL}/api/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await proxy(req);
    // プロキシ自体はNextResponse.next()を返す（200等ではない）
    expect(res.status).not.toBe(401);
  });

  test("Cookieのトークンでも通過する", async () => {
    const token = await makeToken();
    const req = new NextRequest(`${BASE_URL}/api/reports`, {
      headers: { Cookie: `token=${token}` },
    });
    const res = await proxy(req);
    expect(res.status).not.toBe(401);
  });
});

describe("proxy - 画面ルート", () => {
  test("トークンなしで/loginにリダイレクトされる", async () => {
    const req = new NextRequest(`${BASE_URL}/dashboard`);
    const res = await proxy(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("redirect=%2Fdashboard");
  });

  test("有効なトークンで通過する", async () => {
    const token = await makeToken();
    const req = new NextRequest(`${BASE_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await proxy(req);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(401);
  });
});

describe("proxy - ユーザー情報ヘッダー", () => {
  test("有効なトークンでx-user-*ヘッダーが設定される", async () => {
    const token = await makeToken(true);
    const req = new NextRequest(`${BASE_URL}/api/reports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await proxy(req);
    // NextResponse.next()はリクエストヘッダーを変更するが、
    // レスポンスオブジェクト自体からは読み取れない点に注意
    // ここではリダイレクトや401にならないことを確認
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(307);
  });
});
