// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockGetSession, mockCount, mockFindMany, mockFindUnique, mockCreate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockCount: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    salesperson: { count: mockCount, findMany: mockFindMany, findUnique: mockFindUnique, create: mockCreate },
  },
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed_password") } }));

import { GET, POST } from "../route";

// ── テスト用データ ────────────────────────────────────────────────────────────

const salesSession = { id: 2, name: "山田 太郎", email: "yamada@test.com", is_manager: false };
const managerSession = { id: 1, name: "鈴木 部長", email: "suzuki@test.com", is_manager: true };

const BASE_URL = "http://localhost:3000";

function makeSalesperson(id: number, name: string, isManager = false, managerName: string | null = "鈴木 部長") {
  return {
    id,
    name,
    email: `${name.replace(" ", "")}@test.com`,
    department: "東日本営業部",
    isManager,
    managerId: managerName ? 1 : null,
    manager: managerName ? { name: managerName } : null,
  };
}

function makeRequest(query = "") {
  return new NextRequest(`${BASE_URL}/api/salespersons${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── SLS-001：営業一覧取得 ──────────────────────────────────────────────────────

describe("GET /api/salespersons - 正常系 (SLS-001)", () => {
  test("上長が営業一覧を正常取得できる (SLS-001-1)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([
      makeSalesperson(2, "山田 太郎"),
      makeSalesperson(3, "田中 次郎"),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0]).toMatchObject({
      id: 2,
      name: "山田 太郎",
      is_manager: false,
      manager_name: "鈴木 部長",
    });
    expect(body.data.pagination).toMatchObject({
      total: 2,
      total_pages: 1,
      current_page: 1,
      per_page: 20,
    });
  });

  test("q=山田 で氏名検索できる (SLS-001-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeSalesperson(2, "山田 太郎")]);

    const res = await GET(makeRequest("?q=山田"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].name).toBe("山田 太郎");
  });

  test("検索結果0件のとき items: [] が返る", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest("?q=存在しない営業"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
  });

  test("department・manager_name が null の営業も正常に返る", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([
      { ...makeSalesperson(1, "鈴木 部長", true, null), department: null, managerId: null, manager: null },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items[0].department).toBeNull();
    expect(body.data.items[0].manager_name).toBeNull();
    expect(body.data.items[0].manager_id).toBeNull();
  });

  test("ページネーションが正しく計算される", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockCount.mockResolvedValue(45);
    mockFindMany.mockResolvedValue([makeSalesperson(1, "営業 一郎")]);

    const res = await GET(makeRequest("?page=2&per_page=20"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.pagination).toMatchObject({
      total: 45,
      total_pages: 3,
      current_page: 2,
      per_page: 20,
    });
  });
});

describe("GET /api/salespersons - 権限・認証エラー (SLS-001)", () => {
  test("営業ユーザーが一覧取得すると 403 FORBIDDEN (SLS-001-5)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("未認証で 401 UNAUTHORIZED が返る", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

// ── SLS-002：営業登録 ─────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new NextRequest(`${BASE_URL}/api/salespersons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPostBody = {
  name: "山田 太郎",
  email: "yamada@test.com",
  password: "password123",
  department: "東日本営業部",
  manager_id: 1,
  is_manager: false,
};

describe("POST /api/salespersons - 正常系 (SLS-002)", () => {
  test("上長が営業を正常に登録すると 201 Created (SLS-002-1)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue({ isManager: true });
    mockCreate.mockResolvedValue({ id: 2, name: "山田 太郎", email: "yamada@test.com" });

    const res = await POST(makePostRequest(validPostBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 2, name: "山田 太郎", email: "yamada@test.com" });
  });

  test("is_manager: true で上長として登録できる (SLS-002-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue({ isManager: true });
    mockCreate.mockResolvedValue({ id: 3, name: "新 部長", email: "shin@test.com" });

    const res = await POST(makePostRequest({ ...validPostBody, name: "新 部長", email: "shin@test.com", is_manager: true }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(3);
  });
});

describe("POST /api/salespersons - バリデーションエラー (SLS-002)", () => {
  test("name が空で 400 VALIDATION_ERROR (SLS-002-3)", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await POST(makePostRequest({ ...validPostBody, name: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("メールアドレスの形式不正で 400 VALIDATION_ERROR (SLS-002-5)", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await POST(makePostRequest({ ...validPostBody, email: "not-email" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("パスワードが7文字で 400 VALIDATION_ERROR (SLS-002-6)", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await POST(makePostRequest({ ...validPostBody, password: "Test123" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("manager_id に営業ユーザーを指定すると 400 VALIDATION_ERROR (SLS-002-7)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue({ isManager: false });

    const res = await POST(makePostRequest({ ...validPostBody, manager_id: 2 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("manager_id が存在しない場合 400 VALIDATION_ERROR", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makePostRequest({ ...validPostBody, manager_id: 9999 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/salespersons - 409 / 403 / 401 (SLS-002)", () => {
  test("メールアドレスが重複すると 409 CONFLICT (SLS-002-4)", async () => {
    const { Prisma } = await import("@prisma/client");
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue({ isManager: true });
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "0.0.0" }),
    );

    const res = await POST(makePostRequest(validPostBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
  });

  test("営業ユーザーが登録すると 403 FORBIDDEN (SLS-002-8)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await POST(makePostRequest(validPostBody));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("未認証で 401 UNAUTHORIZED が返る", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makePostRequest(validPostBody));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
