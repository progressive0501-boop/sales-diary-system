// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockGetSession, mockCount, mockFindMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockCount: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    customer: { count: mockCount, findMany: mockFindMany },
  },
}));

import { GET } from "../route";

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
