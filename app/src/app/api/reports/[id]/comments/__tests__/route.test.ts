// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockGetSession, mockFindUnique, mockFindMany, mockCreate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));
vi.mock("@/lib/db", () => ({
  prisma: {
    dailyReport: { findUnique: mockFindUnique },
    comment: { findMany: mockFindMany, create: mockCreate },
  },
}));

import { GET, POST } from "../route";

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

  test("plan コメントも problem/plan に正しく分類されて返る", async () => {
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

  test("上長が配下の日報のコメントを取得できる (CMT-001-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportStub);
    mockFindMany.mockResolvedValue([
      makeComment(301, "PROBLEM", "問題コメント"),
    ]);

    const res = await GET(makeRequest("101"), makeParams("101"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.problem).toHaveLength(1);
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports/[id]/comments テスト
// ─────────────────────────────────────────────────────────────────────────────

function makePostRequest(id: string, body: unknown) {
  return new NextRequest(`${BASE_URL}/api/reports/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// 上長セッション: id=1, managerId が reportStub.salesperson.managerId=1 と一致
const reportForManager = {
  salesperson: { managerId: 1 },
};

function makeCreatedComment(targetType: "problem" | "plan") {
  return {
    id: 301,
    reportId: 101,
    targetType: targetType.toUpperCase() as "PROBLEM" | "PLAN",
    commenterId: 1,
    content: "テストコメント",
    createdAt: new Date("2026-04-10T12:00:00Z"),
    commenter: { name: "鈴木 部長" },
  };
}

describe("POST /api/reports/[id]/comments - 正常系", () => {
  test("上長が problem にコメントを投稿すると 201 Created (CMT-002-1)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportForManager);
    mockCreate.mockResolvedValue(makeCreatedComment("problem"));

    const res = await POST(
      makePostRequest("101", { target_type: "problem", content: "テストコメント" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: 301,
      report_id: 101,
      target_type: "problem",
      commenter_id: 1,
      commenter_name: "鈴木 部長",
      content: "テストコメント",
    });
    expect(body.data.created_at).toBeDefined();
  });

  test("上長が plan にコメントを投稿すると 201 Created (CMT-002-2)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportForManager);
    mockCreate.mockResolvedValue(makeCreatedComment("plan"));

    const res = await POST(
      makePostRequest("101", { target_type: "plan", content: "計画コメント" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.target_type).toBe("plan");
  });

  test("同一日報に複数コメントを投稿できる (CMT-002-3)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportForManager);
    mockCreate
      .mockResolvedValueOnce(makeCreatedComment("problem"))
      .mockResolvedValueOnce({ ...makeCreatedComment("problem"), id: 302 });

    const res1 = await POST(
      makePostRequest("101", { target_type: "problem", content: "1件目" }),
      makeParams("101"),
    );
    const res2 = await POST(
      makePostRequest("101", { target_type: "problem", content: "2件目" }),
      makeParams("101"),
    );

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });
});

describe("POST /api/reports/[id]/comments - 権限エラー", () => {
  test("営業ユーザーが投稿すると 403 FORBIDDEN (CMT-002-4)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await POST(
      makePostRequest("101", { target_type: "problem", content: "コメント" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("配下外の日報へのコメントで 403 FORBIDDEN (CMT-002-8)", async () => {
    const otherManagerSession = {
      id: 4,
      name: "他部署 上長",
      email: "other@test.com",
      is_manager: true,
    };
    mockGetSession.mockResolvedValue(otherManagerSession); // id=4
    mockFindUnique.mockResolvedValue(reportForManager); // managerId=1 ≠ 4

    const res = await POST(
      makePostRequest("101", { target_type: "problem", content: "コメント" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/reports/[id]/comments - バリデーションエラー", () => {
  test("target_type が不正値で 400 VALIDATION_ERROR (CMT-002-5)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportForManager);

    const res = await POST(
      makePostRequest("101", { target_type: "visit", content: "コメント" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("content が空文字で 400 VALIDATION_ERROR (CMT-002-6)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportForManager);

    const res = await POST(
      makePostRequest("101", { target_type: "problem", content: "" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("content が2001文字で 400 VALIDATION_ERROR (CMT-002-7)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(reportForManager);

    const res = await POST(
      makePostRequest("101", { target_type: "problem", content: "a".repeat(2001) }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/reports/[id]/comments - 404 / 401", () => {
  test("存在しない report_id で 404 NOT_FOUND (CMT-002-9)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(
      makePostRequest("9999", { target_type: "problem", content: "コメント" }),
      makeParams("9999"),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("未認証で 401 UNAUTHORIZED が返る", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(
      makePostRequest("101", { target_type: "problem", content: "コメント" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
