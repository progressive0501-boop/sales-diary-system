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
    salesperson: { count: mockCount, findMany: mockFindMany },
  },
}));

import { GET } from "../route";

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
