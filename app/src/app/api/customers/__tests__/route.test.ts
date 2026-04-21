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
    customer: { count: mockCount, findMany: mockFindMany, create: mockCreate },
    salesperson: { findUnique: mockFindUnique },
  },
}));

import { GET, POST } from "../route";

// ── テスト用データ ────────────────────────────────────────────────────────────

const salesSession = { id: 2, name: "山田 太郎", email: "yamada@test.com", is_manager: false };
const managerSession = { id: 1, name: "鈴木 部長", email: "suzuki@test.com", is_manager: true };

const BASE_URL = "http://localhost:3000";

function makeCustomer(id: number, name: string, company: string, salesperson = "山田 太郎") {
  return {
    id,
    name,
    company,
    phone: "03-1234-5678",
    address: "東京都千代田区",
    assignedSalespersonId: 2,
    assignedSalesperson: { name: salesperson },
  };
}

function makeRequest(query = "") {
  return new NextRequest(`${BASE_URL}/api/customers${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── CST-001：顧客一覧取得 ──────────────────────────────────────────────────────

describe("GET /api/customers - 正常系 (CST-001)", () => {
  test("顧客一覧を取得できる (CST-001-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([
      makeCustomer(10, "田中 一郎", "株式会社A"),
      makeCustomer(11, "佐藤 花子", "有限会社B"),
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0]).toMatchObject({
      id: 10,
      name: "田中 一郎",
      company: "株式会社A",
      assigned_salesperson_name: "山田 太郎",
    });
    expect(body.data.pagination).toMatchObject({
      total: 2,
      total_pages: 1,
      current_page: 1,
      per_page: 20,
    });
  });

  test("q=佐藤 で顧客名検索できる (CST-001-2)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeCustomer(11, "佐藤 花子", "有限会社B")]);

    const res = await GET(makeRequest("?q=佐藤"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].name).toBe("佐藤 花子");
    // Prisma の where 句が name の部分一致検索を含むことを確認
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
    expect(whereArg.OR[0].name.contains).toBe("佐藤");
  });

  test("q=株式会社A で会社名検索できる (CST-001-3)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeCustomer(10, "田中 一郎", "株式会社A")]);

    const res = await GET(makeRequest("?q=株式会社A"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].company).toBe("株式会社A");
    // Prisma の where 句が company の部分一致検索を含むことを確認
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.OR).toBeDefined();
    expect(whereArg.OR[1].company.contains).toBe("株式会社A");
  });

  test("検索結果0件のとき items: [] が返る (CST-001-4)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest("?q=存在しない顧客"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
  });

  test("上長も顧客一覧を取得できる", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeCustomer(10, "田中 一郎", "株式会社A")]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
  });

  test("ページネーションが正しく計算される", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(45);
    mockFindMany.mockResolvedValue([makeCustomer(1, "顧客1", "会社1")]);

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

  test("phone・address が null の顧客も正常に返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([
      { ...makeCustomer(10, "田中 一郎", "株式会社A"), phone: null, address: null },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items[0].phone).toBeNull();
    expect(body.data.items[0].address).toBeNull();
  });
});

describe("GET /api/customers - 認証エラー", () => {
  test("未認証で 401 UNAUTHORIZED が返る", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

// ── CST-003：顧客登録 ─────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new NextRequest(`${BASE_URL}/api/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPostBody = {
  name: "田中 一郎",
  company: "株式会社A",
  phone: "03-1234-5678",
  address: "東京都千代田区",
  assigned_salesperson_id: 2,
};

describe("POST /api/customers - 正常系 (CST-003)", () => {
  test("全フィールドで顧客を登録すると 201 Created (CST-003-1)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue({ id: 2 });
    mockCreate.mockResolvedValue({ id: 10, name: "田中 一郎", company: "株式会社A" });

    const res = await POST(makePostRequest(validPostBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 10, name: "田中 一郎", company: "株式会社A" });
  });

  test("phone・address 省略でも 201 Created (CST-003-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue({ id: 2 });
    mockCreate.mockResolvedValue({ id: 11, name: "佐藤 花子", company: "有限会社B" });

    const res = await POST(
      makePostRequest({ name: "佐藤 花子", company: "有限会社B", assigned_salesperson_id: 2 }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe(11);
  });
});

describe("POST /api/customers - バリデーションエラー (CST-003)", () => {
  test("name が空で 400 VALIDATION_ERROR (CST-003-3)", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await POST(makePostRequest({ ...validPostBody, name: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("company が空で 400 VALIDATION_ERROR (CST-003-4)", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await POST(makePostRequest({ ...validPostBody, company: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("assigned_salesperson_id が存在しない値で 400 VALIDATION_ERROR (CST-003-5)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makePostRequest({ ...validPostBody, assigned_salesperson_id: 9999 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("name が101文字で 400 VALIDATION_ERROR (CST-003-6)", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await POST(makePostRequest({ ...validPostBody, name: "あ".repeat(101) }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/customers - 権限エラー (CST-003)", () => {
  test("営業ユーザーが登録すると 403 FORBIDDEN (CST-003-7)", async () => {
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
