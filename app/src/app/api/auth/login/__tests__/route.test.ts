// @vitest-environment node
import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

// vi.mock はファイル先頭にホイストされるため、変数は vi.hoisted() で事前初期化する
const { mockCookieSet, mockFindUnique } = vi.hoisted(() => ({
  mockCookieSet: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockCookieSet }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    salesperson: { findUnique: mockFindUnique },
  },
}));

// ── テスト用データ ────────────────────────────────────────────────────────────

import bcrypt from "bcryptjs";

const PASSWORD = "Test1234!";
let passwordHash: string;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-key-that-is-32-chars-long";
  passwordHash = await bcrypt.hash(PASSWORD, 10);
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

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── テスト ────────────────────────────────────────────────────────────────────

// route.ts は vi.mock が解決されてからインポートする必要があるため dynamic import
import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/login - 正常系", () => {
  test("正しい認証情報で 200 OK とトークンが返る", async () => {
    mockFindUnique.mockResolvedValue(salesUser());

    const req = makeRequest({ email: "yamada@test.com", password: PASSWORD });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.token).toBe("string");
    expect(body.data.token.length).toBeGreaterThan(0);
    expect(body.data.expires_at).toBeTruthy();
  });

  test("営業ユーザーで is_manager が false で返る", async () => {
    mockFindUnique.mockResolvedValue(salesUser());

    const req = makeRequest({ email: "yamada@test.com", password: PASSWORD });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.user.is_manager).toBe(false);
    expect(body.data.user.id).toBe(2);
    expect(body.data.user.name).toBe("山田 太郎");
    expect(body.data.user.email).toBe("yamada@test.com");
  });

  test("上長ユーザーで is_manager が true で返る", async () => {
    mockFindUnique.mockResolvedValue(managerUser());

    const req = makeRequest({ email: "suzuki@test.com", password: PASSWORD });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.user.is_manager).toBe(true);
    expect(body.data.user.id).toBe(1);
  });

  test("認証成功時に Cookie が設定される", async () => {
    mockFindUnique.mockResolvedValue(salesUser());

    const req = makeRequest({ email: "yamada@test.com", password: PASSWORD });
    await POST(req);

    expect(mockCookieSet).toHaveBeenCalledWith(
      "token",
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });
});

describe("POST /api/auth/login - 認証失敗", () => {
  test("存在しないメールアドレスで 401 UNAUTHORIZED が返る", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = makeRequest({ email: "notexist@test.com", password: PASSWORD });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("パスワード不一致で 401 UNAUTHORIZED が返る", async () => {
    mockFindUnique.mockResolvedValue(salesUser());

    const req = makeRequest({ email: "yamada@test.com", password: "WrongPass!" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("POST /api/auth/login - バリデーションエラー", () => {
  test("email が空で 400 VALIDATION_ERROR が返る", async () => {
    const req = makeRequest({ email: "", password: PASSWORD });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("password が空で 400 VALIDATION_ERROR が返る", async () => {
    const req = makeRequest({ email: "yamada@test.com", password: "" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("email の形式が不正で 400 VALIDATION_ERROR が返る", async () => {
    const req = makeRequest({ email: "not-email-format", password: PASSWORD });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("email が未指定で 400 VALIDATION_ERROR が返る", async () => {
    const req = makeRequest({ password: PASSWORD });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("password が未指定で 400 VALIDATION_ERROR が返る", async () => {
    const req = makeRequest({ email: "yamada@test.com" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("不正な JSON で 400 VALIDATION_ERROR が返る", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json{",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
