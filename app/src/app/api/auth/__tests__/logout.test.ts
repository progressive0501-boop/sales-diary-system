// @vitest-environment node
/**
 * AUTH-003：ログアウト
 */
import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signToken } from "@/lib/auth/jwt";
import { proxy } from "../../../../proxy";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockCookieDelete } = vi.hoisted(() => ({
  mockCookieDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ delete: mockCookieDelete }),
}));

import { POST } from "../logout/route";

// ── セットアップ ──────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3000";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-key-that-is-32-chars-long";
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function makeValidToken(is_manager = false) {
  return signToken({
    sub: "2",
    name: "山田 太郎",
    email: "yamada@test.com",
    is_manager,
  });
}

// ── AUTH-003：ログアウト ───────────────────────────────────────────────────────

describe("AUTH-003：ログアウト", () => {
  test("有効なトークンでログアウトすると 200 OK (AUTH-003-1)", async () => {
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  test("ログアウトで Cookie の token が削除される (AUTH-003-1 補足)", async () => {
    await POST();

    expect(mockCookieDelete).toHaveBeenCalledWith("token");
    expect(mockCookieDelete).toHaveBeenCalledTimes(1);
  });

  test("ログアウト後、トークンなしで API にアクセスすると 401 UNAUTHORIZED (AUTH-003-2)", async () => {
    // ログアウト（Cookie削除）
    await POST();

    // Cookie なし・Authorization ヘッダーなしで保護 API にアクセス
    const req = new NextRequest(`${BASE_URL}/api/reports`);
    const res = await proxy(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("トークンなしでもログアウトエンドポイントは proxy を通過できる (AUTH-003-3)", async () => {
    // /api/auth/logout は PUBLIC_PATHS に含まれるため、
    // トークンなしでも proxy は NextResponse.next() を返す（認証不要）
    const req = new NextRequest(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
    });
    const res = await proxy(req);

    // パブリックパスなので 401 にならない
    expect(res.status).not.toBe(401);
  });

  test("有効なトークンがあれば logout エンドポイントを proxy が通過させる", async () => {
    const token = await makeValidToken();
    const req = new NextRequest(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await proxy(req);

    // proxy は NextResponse.next() を返すため 401 にならない
    expect(res.status).not.toBe(401);
  });
});
