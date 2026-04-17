// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockGetSession, mockFindMany, mockCount, mockCustomerCount, mockTransaction } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockFindMany: vi.fn(),
    mockCount: vi.fn(),
    mockCustomerCount: vi.fn(),
    mockTransaction: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));

vi.mock("@/lib/db", () => ({
  prisma: {
    salesperson: { findMany: mockFindMany },
    dailyReport: { findMany: mockFindMany, count: mockCount },
    customer: { count: mockCustomerCount },
    $transaction: mockTransaction,
  },
}));

import { GET, POST } from "../route";

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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports テスト
// ─────────────────────────────────────────────────────────────────────────────

const validBody = {
  report_date: "2026-04-17",
  problem: "課題テスト",
  plan: "計画テスト",
  visit_records: [
    { customer_id: 1, visit_content: "訪問内容1", visit_order: 1 },
  ],
};

function makePostRequest(body: unknown) {
  return new NextRequest(new URL(`${BASE_URL}/api/reports`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reports - 正常系", () => {
  test("日報が作成され 201 と { id, report_date } が返る (RPT-003-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCustomerCount.mockResolvedValue(1);
    const createdReport = {
      id: 201,
      reportDate: new Date("2026-04-17"),
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        dailyReport: {
          create: vi.fn().mockResolvedValue(createdReport),
        },
        visitRecord: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return fn(tx);
    });

    const res = await POST(makePostRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(201);
    expect(body.data.report_date).toBe("2026-04-17");
  });

  test("visit_records が複数件でも正常に作成される (RPT-003-2)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCustomerCount.mockResolvedValue(2);
    const createdReport = { id: 202, reportDate: new Date("2026-04-17") };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        dailyReport: { create: vi.fn().mockResolvedValue(createdReport) },
        visitRecord: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      };
      return fn(tx);
    });

    const body2 = {
      ...validBody,
      visit_records: [
        { customer_id: 1, visit_content: "訪問内容1", visit_order: 1 },
        { customer_id: 2, visit_content: "訪問内容2", visit_order: 2 },
      ],
    };

    const res = await POST(makePostRequest(body2));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/reports - 認証・権限エラー", () => {
  test("未認証で 401 UNAUTHORIZED が返る (RPT-003-3)", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makePostRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("上長ユーザーは 403 FORBIDDEN が返る (RPT-003-manager)", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await POST(makePostRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/reports - バリデーションエラー", () => {
  test("リクエストボディが不正な JSON で 400 が返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const req = new NextRequest(new URL(`${BASE_URL}/api/reports`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("report_date が YYYY-MM-DD 形式でない場合 400 が返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await POST(makePostRequest({ ...validBody, report_date: "2026/04/17" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("visit_records が空配列の場合 400 が返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await POST(makePostRequest({ ...validBody, visit_records: [] }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("存在しない customer_id を指定すると 400 が返る (RPT-003-5)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCustomerCount.mockResolvedValue(0); // 0件ヒット → 存在しない

    const res = await POST(makePostRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toMatch(/顧客ID/);
  });
});

describe("POST /api/reports - 重複エラー", () => {
  test("同日の日報が既に存在する場合 409 CONFLICT が返る (RPT-003-4)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCustomerCount.mockResolvedValue(1);

    const { Prisma } = await import("@prisma/client");
    const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "0.0.0",
    });
    mockTransaction.mockRejectedValue(p2002Error);

    const res = await POST(makePostRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
  });
});
