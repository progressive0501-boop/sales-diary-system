// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockGetSession, mockFindUnique, mockFindMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    dailyReport: { findUnique: mockFindUnique },
    visitRecord: { findMany: mockFindMany },
  },
}));

import { GET } from "../route";

// ── テスト用データ ────────────────────────────────────────────────────────────

const salesSession = {
  id: 2,
  name: "山田 太郎",
  email: "yamada@test.com",
  is_manager: false,
};
const managerSession = {
  id: 1,
  name: "鈴木 部長",
  email: "suzuki@test.com",
  is_manager: true,
};
const otherManagerSession = {
  id: 4,
  name: "他部署 上長",
  email: "other@test.com",
  is_manager: true,
};

const BASE_URL = "http://localhost:3000";

function makeRequest(id: string) {
  return new NextRequest(`${BASE_URL}/api/reports/${id}/visit_records`);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// 日報（アクセス制御用）: salespersonId=2, managerId=1
const reportStub = {
  salespersonId: 2,
  salesperson: { managerId: 1 },
};

function makeVisitRecord(id: number, visitOrder: number) {
  return {
    id,
    customerId: 10,
    visitContent: `訪問内容${visitOrder}`,
    visitOrder,
    customer: { name: "佐藤 一郎", company: "株式会社A" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── テスト ────────────────────────────────────────────────────────────────────

describe("GET /api/reports/[id]/visit_records - 正常系", () => {
  test("自分の日報の訪問記録を visit_order 順で取得できる (VST-001-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([
      makeVisitRecord(201, 1),
      makeVisitRecord(202, 2),
    ]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0]).toMatchObject({
      id: 201,
      customer_id: 10,
      customer_name: "佐藤 一郎",
      customer_company: "株式会社A",
      visit_content: "訪問内容1",
      visit_order: 1,
    });
    expect(body.data.items[1].visit_order).toBe(2);
  });

  test("上長が配下の日報の訪問記録を取得できる (VST-001-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([makeVisitRecord(201, 1)]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
  });

  test("訪問記録が0件のとき空配列が返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(0);
  });
});

describe("GET /api/reports/[id]/visit_records - アクセス制御", () => {
  test("他の営業の日報を営業が取得すると 403 FORBIDDEN (VST-001-3)", async () => {
    const otherSalesSession = {
      id: 3,
      name: "田中 次郎",
      email: "tanaka@test.com",
      is_manager: false,
    };
    mockGetSession.mockResolvedValue(otherSalesSession);
    mockFindUnique.mockResolvedValue(reportStub); // salespersonId=2

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("配下外の上長が取得しようとすると 403 FORBIDDEN", async () => {
    mockGetSession.mockResolvedValue(otherManagerSession); // id=4
    mockFindUnique.mockResolvedValue(reportStub); // managerId=1

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/reports/[id]/visit_records - 404 NOT_FOUND", () => {
  test("存在しない report_id で 404 NOT_FOUND (VST-001-4)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("9999"), makeParams("9999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("数値でない ID で 404 NOT_FOUND", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await GET(makeRequest("abc"), makeParams("abc"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/reports/[id]/visit_records - 認証エラー", () => {
  test("未認証で 401 UNAUTHORIZED が返る", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
