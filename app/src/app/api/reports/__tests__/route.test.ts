// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockGetSession, mockFindMany, mockCount } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));

vi.mock("@/lib/db", () => ({
  prisma: {
    salesperson: { findMany: mockFindMany },
    dailyReport: { findMany: mockFindMany, count: mockCount },
  },
}));

import { GET } from "../route";

// ── テスト用データ ────────────────────────────────────────────────────────────

const salesSession = { id: 2, name: "山田 太郎", email: "yamada@test.com", is_manager: false };
const managerSession = { id: 1, name: "鈴木 部長", email: "suzuki@test.com", is_manager: true };

const BASE_URL = "http://localhost:3000";

function makeRequest(query: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}/api/reports`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function makeReport(id: number, salespersonId: number, salespersonName: string) {
  return {
    id,
    salespersonId,
    reportDate: new Date("2026-04-10"),
    problem: null,
    plan: null,
    createdAt: new Date("2026-04-10T10:00:00Z"),
    updatedAt: new Date("2026-04-10T10:00:00Z"),
    salesperson: { name: salespersonName },
    _count: { visitRecords: 2, comments: 1 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── テスト ────────────────────────────────────────────────────────────────────

describe("GET /api/reports - 営業ユーザー", () => {
  test("自分の日報のみ返る (RPT-001-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeReport(101, 2, "山田 太郎")]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].id).toBe(101);
    expect(body.data.items[0].salesperson_id).toBe(2);
    expect(body.data.items[0].visit_count).toBe(2);
    expect(body.data.items[0].has_comment).toBe(true);
  });

  test("レスポンスに report_date が YYYY-MM-DD 形式で含まれる", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeReport(101, 2, "山田 太郎")]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.data.items[0].report_date).toBe("2026-04-10");
  });

  test("他人の salesperson_id を指定すると 403 FORBIDDEN (RPT-001 前提: 営業は他人不可)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await GET(makeRequest({ salesperson_id: "3" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("自分の salesperson_id を指定しても 200 で返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeReport(101, 2, "山田 太郎")]);

    const res = await GET(makeRequest({ salesperson_id: "2" }));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/reports - 上長ユーザー", () => {
  test("配下全員の日報が返る (RPT-001-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    // 1回目: subordinates, 2回目: count, 3回目: findMany reports
    mockFindMany
      .mockResolvedValueOnce([{ id: 2 }, { id: 3 }]) // subordinates
      .mockResolvedValueOnce([
        makeReport(101, 2, "山田 太郎"),
        makeReport(102, 3, "田中 次郎"),
      ]);
    mockCount.mockResolvedValue(2);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(2);
    const ids = body.data.items.map((i: { id: number }) => i.id);
    expect(ids).toContain(101);
    expect(ids).toContain(102);
  });

  test("salesperson_id フィルターで特定営業の日報のみ返る (RPT-001-3)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindMany
      .mockResolvedValueOnce([{ id: 2 }, { id: 3 }]) // subordinates
      .mockResolvedValueOnce([makeReport(101, 2, "山田 太郎")]);
    mockCount.mockResolvedValue(1);

    const res = await GET(makeRequest({ salesperson_id: "2" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].id).toBe(101);
  });

  test("配下外の salesperson_id を指定すると空リストが返る", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindMany.mockResolvedValueOnce([{ id: 2 }, { id: 3 }]); // subordinates
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValueOnce([]); // reports (salespersonIds=[])

    const res = await GET(makeRequest({ salesperson_id: "99" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(0);
    expect(body.data.pagination.total).toBe(0);
  });
});

describe("GET /api/reports - year_month フィルター", () => {
  test("year_month 指定で該当月の日報のみ返る (RPT-001-4)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeReport(101, 2, "山田 太郎")]);

    const res = await GET(makeRequest({ year_month: "2026-04" }));
    await res.json();

    expect(res.status).toBe(200);
    // Prisma の where に reportDate フィルターが渡されたことを確認
    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.reportDate).toBeDefined();
    expect(whereArg.reportDate.gte).toEqual(new Date(2026, 3, 1));
    expect(whereArg.reportDate.lt).toEqual(new Date(2026, 4, 1));
  });

  test("存在しない年月で空リストが返る (RPT-001-5)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ year_month: "2020-01" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(0);
    expect(body.data.pagination.total).toBe(0);
  });
});

describe("GET /api/reports - ページネーション", () => {
  test("page=1&per_page=1 で 1 件のみ返り pagination に total が含まれる (RPT-001-6)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(3);
    mockFindMany.mockResolvedValue([makeReport(101, 2, "山田 太郎")]);

    const res = await GET(makeRequest({ page: "1", per_page: "1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.pagination.total).toBe(3);
    expect(body.data.pagination.total_pages).toBe(3);
    expect(body.data.pagination.current_page).toBe(1);
    expect(body.data.pagination.per_page).toBe(1);
  });

  test("デフォルトのページネーション値が適用される", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.data.pagination.current_page).toBe(1);
    expect(body.data.pagination.per_page).toBe(20);
  });
});

describe("GET /api/reports - バリデーションエラー", () => {
  test("year_month 形式不正で 400 VALIDATION_ERROR が返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await GET(makeRequest({ year_month: "2026/04" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
