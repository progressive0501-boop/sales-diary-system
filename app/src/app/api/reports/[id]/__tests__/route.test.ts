// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockGetSession, mockFindUnique } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/db", () => ({
  prisma: { dailyReport: { findUnique: mockFindUnique } },
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
  return new NextRequest(`${BASE_URL}/api/reports/${id}`);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeReport(overrides: Partial<ReturnType<typeof defaultReport>> = {}) {
  return { ...defaultReport(), ...overrides };
}

function defaultReport() {
  return {
    id: 101,
    salespersonId: 2,
    reportDate: new Date("2026-04-10"),
    problem: "テスト課題",
    plan: "テスト計画",
    createdAt: new Date("2026-04-10T10:00:00Z"),
    updatedAt: new Date("2026-04-10T10:00:00Z"),
    salesperson: { name: "山田 太郎", managerId: 1 },
    visitRecords: [
      {
        id: 201,
        customerId: 10,
        visitContent: "提案実施",
        visitOrder: 1,
        customer: { name: "佐藤 一郎", company: "株式会社A" },
      },
      {
        id: 202,
        customerId: 11,
        visitContent: "定期訪問",
        visitOrder: 2,
        customer: { name: "中村 花子", company: "株式会社B" },
      },
    ],
    comments: [
      {
        id: 301,
        commenterId: 1,
        targetType: "PROBLEM" as const,
        content: "標準条件で対応してください",
        createdAt: new Date("2026-04-10T12:00:00Z"),
        commenter: { name: "鈴木 部長" },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── テスト ────────────────────────────────────────────────────────────────────

describe("GET /api/reports/[id] - 正常系", () => {
  test("営業が自分の日報を取得すると訪問記録・コメントを含む詳細が返る (RPT-002-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(makeReport());

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const data = body.data;
    expect(data.id).toBe(101);
    expect(data.salesperson_id).toBe(2);
    expect(data.salesperson_name).toBe("山田 太郎");
    expect(data.report_date).toBe("2026-04-10");
    expect(data.problem).toBe("テスト課題");
    expect(data.plan).toBe("テスト計画");
  });

  test("訪問記録が customer_name・customer_company を含んで返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(makeReport());

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(body.data.visit_records).toHaveLength(2);
    expect(body.data.visit_records[0]).toMatchObject({
      id: 201,
      customer_id: 10,
      customer_name: "佐藤 一郎",
      customer_company: "株式会社A",
      visit_content: "提案実施",
      visit_order: 1,
    });
  });

  test("コメントが problem / plan に分類されて返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(makeReport());

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(body.data.comments.problem).toHaveLength(1);
    expect(body.data.comments.problem[0]).toMatchObject({
      id: 301,
      commenter_id: 1,
      commenter_name: "鈴木 部長",
      content: "標準条件で対応してください",
    });
    expect(body.data.comments.plan).toHaveLength(0);
  });

  test("上長が配下の日報を取得できる (RPT-002-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(makeReport());

    const res = await GET(makeRequest("101"), makeParams("101"));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/reports/[id] - アクセス制御", () => {
  test("他の営業の日報を営業が取得すると 403 FORBIDDEN (RPT-002-4)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    // salespersonId=3 (田中次郎) の日報 → 山田太郎は閲覧不可
    mockFindUnique.mockResolvedValue(
      makeReport({ salespersonId: 3, salesperson: { name: "田中 次郎", managerId: 1 } }),
    );

    const res = await GET(makeRequest("102"), makeParams("102"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("配下外の日報を上長が取得すると 403 FORBIDDEN (RPT-002-5)", async () => {
    mockGetSession.mockResolvedValue(otherManagerSession);
    // managerId=1 (鈴木部長配下) の日報 → 他部署上長(id=4)は閲覧不可
    mockFindUnique.mockResolvedValue(makeReport());

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/reports/[id] - 404 NOT_FOUND", () => {
  test("存在しない ID で 404 NOT_FOUND (RPT-002-3)", async () => {
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
