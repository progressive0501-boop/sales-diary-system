// @vitest-environment node
/**
 * RPT-002：日報詳細取得
 * RPT-004：日報更新
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockGetSession, mockFindUnique, mockCustomerCount, mockTransaction } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockFindUnique: vi.fn(),
    mockCustomerCount: vi.fn(),
    mockTransaction: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));

vi.mock("@/lib/db", () => ({
  prisma: {
    dailyReport: { findUnique: mockFindUnique },
    customer: { count: mockCustomerCount },
    $transaction: mockTransaction,
  },
}));

import { GET, PUT } from "../[id]/route";

// ── テスト用データ ────────────────────────────────────────────────────────────

const salesSession = { id: 2, name: "山田 太郎", email: "yamada@test.com", is_manager: false };
const managerSession = { id: 1, name: "鈴木 部長", email: "suzuki@test.com", is_manager: true };
const otherSalesSession = { id: 3, name: "田中 次郎", email: "tanaka@test.com", is_manager: false };
const otherManagerSession = { id: 4, name: "他部署上長", email: "other@test.com", is_manager: true };

const BASE_URL = "http://localhost:3000";

function makeGetRequest(id: string) {
  return new NextRequest(`${BASE_URL}/api/reports/${id}`);
}

function makePutRequest(id: string, body: unknown) {
  return new NextRequest(new URL(`${BASE_URL}/api/reports/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeDetailReport() {
  return {
    id: 101,
    salespersonId: 2,
    reportDate: new Date("2026-04-10"),
    problem: "課題テスト",
    plan: "計画テスト",
    createdAt: new Date("2026-04-10T10:00:00Z"),
    updatedAt: new Date("2026-04-10T10:00:00Z"),
    salesperson: { name: "山田 太郎", managerId: 1 },
    visitRecords: [
      {
        id: 1001,
        customerId: 1,
        visitContent: "訪問内容1",
        visitOrder: 1,
        customer: { name: "顧客A", company: "会社A" },
      },
      {
        id: 1002,
        customerId: 2,
        visitContent: "訪問内容2",
        visitOrder: 2,
        customer: { name: "顧客B", company: "会社B" },
      },
    ],
    comments: [
      {
        id: 301,
        commenterId: 1,
        targetType: "PROBLEM",
        content: "コメント内容",
        createdAt: new Date("2026-04-10T12:00:00Z"),
        commenter: { name: "鈴木 部長" },
      },
    ],
  };
}

const validUpdateBody = {
  report_date: "2026-04-10",
  problem: "更新後の課題",
  plan: "更新後の計画",
  visit_records: [
    { customer_id: 1, visit_content: "更新後の訪問内容1", visit_order: 1 },
    { customer_id: 2, visit_content: "更新後の訪問内容2", visit_order: 2 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── RPT-002：日報詳細取得 ──────────────────────────────────────────────────────

describe("GET /api/reports/:id - RPT-002", () => {
  test("自分の日報を取得すると 200 OK で日報・訪問記録・コメントが返る (RPT-002-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(makeDetailReport());

    const res = await GET(makeGetRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(101);
    expect(body.data.salesperson_id).toBe(2);
    expect(body.data.report_date).toBe("2026-04-10");
    expect(Array.isArray(body.data.visit_records)).toBe(true);
    expect(body.data.visit_records).toHaveLength(2);
    expect(body.data.comments).toBeDefined();
    expect(Array.isArray(body.data.comments.problem)).toBe(true);
    expect(body.data.comments.problem).toHaveLength(1);
    expect(body.data.comments.problem[0].id).toBe(301);
  });

  test("上長が配下の日報を取得すると 200 OK (RPT-002-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(makeDetailReport()); // managerId: 1 = managerSession.id

    const res = await GET(makeGetRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(101);
  });

  test("存在しない日報 ID を指定すると 404 NOT_FOUND (RPT-002-3)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(makeGetRequest("9999"), makeParams("9999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("他の営業の日報を営業が取得すると 403 FORBIDDEN (RPT-002-4)", async () => {
    mockGetSession.mockResolvedValue(otherSalesSession); // id: 3
    mockFindUnique.mockResolvedValue(makeDetailReport()); // salespersonId: 2

    const res = await GET(makeGetRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("配下外の日報を上長が取得すると 403 FORBIDDEN (RPT-002-5)", async () => {
    mockGetSession.mockResolvedValue(otherManagerSession); // id: 4
    mockFindUnique.mockResolvedValue(makeDetailReport()); // managerId: 1 ≠ 4

    const res = await GET(makeGetRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

// ── RPT-004：日報更新 ─────────────────────────────────────────────────────────

describe("PUT /api/reports/:id - RPT-004", () => {
  test("自分の日報を正常に更新すると 200 OK で updated_at が返る (RPT-004-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue({ salespersonId: 2 }); // existing report
    mockCustomerCount.mockResolvedValue(2);
    const updatedReport = {
      id: 101,
      reportDate: new Date("2026-04-10"),
      updatedAt: new Date("2026-04-10T15:00:00Z"),
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        visitRecord: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        dailyReport: { update: vi.fn().mockResolvedValue(updatedReport) },
      };
      // visitRecord.createMany is called after dailyReport.update
      (tx as Record<string, unknown>).visitRecord = {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      };
      return fn(tx);
    });

    const res = await PUT(makePutRequest("101", validUpdateBody), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(101);
    expect(body.data.report_date).toBe("2026-04-10");
    expect(typeof body.data.updated_at).toBe("string");
  });

  test("訪問記録を3件に追加して更新すると 200 OK (RPT-004-2)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue({ salespersonId: 2 });
    mockCustomerCount.mockResolvedValue(3);
    const updatedReport = {
      id: 101,
      reportDate: new Date("2026-04-10"),
      updatedAt: new Date("2026-04-10T15:00:00Z"),
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        visitRecord: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          createMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
        dailyReport: { update: vi.fn().mockResolvedValue(updatedReport) },
      };
      return fn(tx);
    });

    const body3 = {
      ...validUpdateBody,
      visit_records: [
        { customer_id: 1, visit_content: "訪問1", visit_order: 1 },
        { customer_id: 2, visit_content: "訪問2", visit_order: 2 },
        { customer_id: 3, visit_content: "訪問3", visit_order: 3 },
      ],
    };

    const res = await PUT(makePutRequest("101", body3), makeParams("101"));
    expect(res.status).toBe(200);
  });

  test("訪問記録を1件に削減して更新すると 200 OK (RPT-004-3)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue({ salespersonId: 2 });
    mockCustomerCount.mockResolvedValue(1);
    const updatedReport = {
      id: 101,
      reportDate: new Date("2026-04-10"),
      updatedAt: new Date("2026-04-10T15:00:00Z"),
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        visitRecord: {
          deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        dailyReport: { update: vi.fn().mockResolvedValue(updatedReport) },
      };
      return fn(tx);
    });

    const body1 = {
      ...validUpdateBody,
      visit_records: [
        { customer_id: 1, visit_content: "訪問1のみ", visit_order: 1 },
      ],
    };

    const res = await PUT(makePutRequest("101", body1), makeParams("101"));
    expect(res.status).toBe(200);
  });

  test("他の営業の日報を更新しようとすると 403 FORBIDDEN (RPT-004-4)", async () => {
    mockGetSession.mockResolvedValue(otherSalesSession); // id: 3
    mockFindUnique.mockResolvedValue({ salespersonId: 2 }); // owner: 2

    const res = await PUT(makePutRequest("101", validUpdateBody), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("上長が日報を更新しようとすると 403 FORBIDDEN (RPT-004-5)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue({ salespersonId: 2 });

    const res = await PUT(makePutRequest("101", validUpdateBody), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("存在しない日報 ID を更新しようとすると 404 NOT_FOUND (RPT-004-6)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(null);

    const res = await PUT(makePutRequest("9999", validUpdateBody), makeParams("9999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
