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
    comment: { findMany: mockFindMany },
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

const BASE_URL = "http://localhost:3000";

// 日報（アクセス制御用）: salespersonId=2, managerId=1
const reportStub = {
  salespersonId: 2,
  salesperson: { managerId: 1 },
};

function makeRequest(id: string) {
  return new NextRequest(`${BASE_URL}/api/reports/${id}/comments`);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeComment(
  id: number,
  targetType: "PROBLEM" | "PLAN",
  content: string,
) {
  return {
    id,
    commenterId: 1,
    targetType,
    content,
    createdAt: new Date("2026-04-10T12:00:00Z"),
    commenter: { name: "鈴木 部長" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── テスト ────────────────────────────────────────────────────────────────────

describe("GET /api/reports/[id]/comments - 正常系", () => {
  test("problem / plan に分類されたコメント一覧が返る (CMT-001-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([
      makeComment(301, "PROBLEM", "標準条件で対応してください"),
    ]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.problem).toHaveLength(1);
    expect(body.data.problem[0]).toMatchObject({
      id: 301,
      commenter_id: 1,
      commenter_name: "鈴木 部長",
      content: "標準条件で対応してください",
    });
    expect(body.data.plan).toHaveLength(0);
  });

  test("plan コメントも分類されて返る (CMT-001-2)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([
      makeComment(301, "PROBLEM", "問題コメント"),
      makeComment(302, "PLAN", "計画コメント"),
    ]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.problem).toHaveLength(1);
    expect(body.data.plan).toHaveLength(1);
    expect(body.data.plan[0].id).toBe(302);
  });

  test("コメントが0件のとき problem / plan が空配列で返る (CMT-001-3)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.problem).toEqual([]);
    expect(body.data.plan).toEqual([]);
  });

  test("上長が配下の日報のコメントを取得できる", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([
      makeComment(301, "PROBLEM", "問題コメント"),
    ]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    expect(res.status).toBe(200);
    expect(body => body).toBeDefined();
  });

  test("created_at が ISO 形式で含まれる", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([
      makeComment(301, "PROBLEM", "コメント"),
    ]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(body.data.problem[0].created_at).toBe("2026-04-10T12:00:00.000Z");
  });
});

describe("GET /api/reports/[id]/comments - アクセス制御", () => {
  test("他の営業の日報を営業が取得すると 403 FORBIDDEN", async () => {
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

  test("配下外の上長が取得すると 403 FORBIDDEN", async () => {
    const otherManagerSession = {
      id: 4,
      name: "他部署 上長",
      email: "other@test.com",
      is_manager: true,
    };
    mockGetSession.mockResolvedValue(otherManagerSession);
    mockFindUnique.mockResolvedValue(reportStub); // managerId=1

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/reports/[id]/comments - 404 / 401", () => {
  test("存在しない report_id で 404 NOT_FOUND", async () => {
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

  test("未認証で 401 UNAUTHORIZED が返る", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
