// @vitest-environment node
/**
 * AUTH-001：ログイン正常系
 * AUTH-002：ログイン異常系
 */
import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockCookieSet, mockFindUnique } = vi.hoisted(() => ({
  mockCookieSet: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockCookieSet }),
}));

vi.mock("@/lib/db", () => ({
  prisma: { salesperson: { findUnique: mockFindUnique } },
}));

import { POST } from "../login/route";

// ── テスト用データ ────────────────────────────────────────────────────────────

const PASSWORD = "Test1234!";
let passwordHash: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-key-that-is-32-chars-long";
  passwordHash = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(() => {
  vi.clearAllMocks();
});

const salesUser = () => ({
  id: 2,
  name: "山田 太郎",
  email: "yamada@test.com",
  passwordHash,
  isManager: false,
  managerId: 1,
  department: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const managerUser = () => ({
  id: 1,
  name: "鈴木 部長",
  email: "suzuki@test.com",
  passwordHash,
  isManager: true,
  managerId: null,
  department: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeLoginRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── AUTH-001：ログイン正常系 ──────────────────────────────────────────────────

describe("AUTH-001：ログイン正常系", () => {
  test("営業ユーザーでログイン成功 → 200 OK、is_manager: false (AUTH-001-1)", async () => {
    mockFindUnique.mockResolvedValue(salesUser());

    const res = await POST(makeLoginRequest({ email: "yamada@test.com", password: PASSWORD }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.token).toBe("string");
    expect(body.data.token.length).toBeGreaterThan(0);
    expect(body.data.expires_at).toBeTruthy();
    expect(body.data.user).toMatchObject({
      id: 2,
      name: "山田 太郎",
      email: "yamada@test.com",
      is_manager: false,
    });
  });

  test("上長ユーザーでログイン成功 → 200 OK、is_manager: true (AUTH-001-2)", async () => {
    mockFindUnique.mockResolvedValue(managerUser());

    const res = await POST(makeLoginRequest({ email: "suzuki@test.com", password: PASSWORD }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user).toMatchObject({
      id: 1,
      name: "鈴木 部長",
      email: "suzuki@test.com",
      is_manager: true,
    });
    expect(typeof body.data.token).toBe("string");
  });

  test("ログイン成功時に HttpOnly Cookie が設定される", async () => {
    mockFindUnique.mockResolvedValue(salesUser());

    await POST(makeLoginRequest({ email: "yamada@test.com", password: PASSWORD }));

    expect(mockCookieSet).toHaveBeenCalledWith(
      "token",
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });
});

// ── AUTH-002：ログイン異常系 ──────────────────────────────────────────────────

describe("AUTH-002：ログイン異常系", () => {
  test("存在しないメールアドレスで 401 UNAUTHORIZED (AUTH-002-1)", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeLoginRequest({ email: "notexist@test.com", password: PASSWORD }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("パスワード不一致で 401 UNAUTHORIZED (AUTH-002-2)", async () => {
    mockFindUnique.mockResolvedValue(salesUser());

    const res = await POST(makeLoginRequest({ email: "yamada@test.com", password: "WrongPass!" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("email が空で 400 VALIDATION_ERROR (AUTH-002-3)", async () => {
    const res = await POST(makeLoginRequest({ email: "", password: PASSWORD }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("password が空で 400 VALIDATION_ERROR (AUTH-002-4)", async () => {
    const res = await POST(makeLoginRequest({ email: "yamada@test.com", password: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("email の形式が不正で 400 VALIDATION_ERROR (AUTH-002-5)", async () => {
    const res = await POST(makeLoginRequest({ email: "not-email-format", password: PASSWORD }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
