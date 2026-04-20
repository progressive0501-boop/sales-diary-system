// @vitest-environment node
/**
 * PRIV-001：エンドポイント別権限確認
 * PRIV-002：未認証アクセス
 */
import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { signToken } from "@/lib/auth/jwt";
import { proxy } from "../proxy";

// ── モック ────────────────────────────────────────────────────────────────────

const {
  mockGetSession,
  mockReportFindUnique,
  mockReportFindMany,
  mockReportCount,
  mockCustomerFindUnique,
  mockCustomerFindMany,
  mockCustomerCount,
  mockSalespersonFindUnique,
  mockSalespersonFindMany,
  mockSalespersonCount,
  mockCommentFindMany,
  mockVisitRecordFindMany,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockReportFindUnique: vi.fn(),
  mockReportFindMany: vi.fn(),
  mockReportCount: vi.fn(),
  mockCustomerFindUnique: vi.fn(),
  mockCustomerFindMany: vi.fn(),
  mockCustomerCount: vi.fn(),
  mockSalespersonFindUnique: vi.fn(),
  mockSalespersonFindMany: vi.fn(),
  mockSalespersonCount: vi.fn(),
  mockCommentFindMany: vi.fn(),
  mockVisitRecordFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));

vi.mock("@/lib/db", () => ({
  prisma: {
    dailyReport: {
      findUnique: mockReportFindUnique,
      findMany: mockReportFindMany,
      count: mockReportCount,
    },
    customer: {
      findUnique: mockCustomerFindUnique,
      findMany: mockCustomerFindMany,
      count: mockCustomerCount,
    },
    salesperson: {
      findUnique: mockSalespersonFindUnique,
      findMany: mockSalespersonFindMany,
      count: mockSalespersonCount,
    },
    comment: { findMany: mockCommentFindMany },
    visitRecord: { findMany: mockVisitRecordFindMany },
  },
}));

import { GET as reportsGET, POST as reportsPOST } from "../app/api/reports/route";
import { GET as reportDetailGET, PUT as reportDetailPUT } from "../app/api/reports/[id]/route";
import { GET as commentsGET, POST as commentsPOST } from "../app/api/reports/[id]/comments/route";
import { GET as visitRecordsGET } from "../app/api/reports/[id]/visit_records/route";
import { GET as customersGET, POST as customersPOST } from "../app/api/customers/route";
import { PUT as customerDetailPUT } from "../app/api/customers/[id]/route";
import { GET as salespersonsGET, POST as salespersonsPOST } from "../app/api/salespersons/route";
import { PUT as salespersonDetailPUT } from "../app/api/salespersons/[id]/route";

// ── セットアップ ──────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3000";
const JWT_SECRET = "test-secret-key-that-is-32-chars-long";

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
});

beforeEach(() => {
  vi.clearAllMocks();
});

const salesSession = { id: 2, name: "山田 太郎", email: "yamada@test.com", is_manager: false };
const managerSession = { id: 1, name: "鈴木 部長", email: "suzuki@test.com", is_manager: true };
const otherSalesSession = { id: 3, name: "田中 次郎", email: "tanaka@test.com", is_manager: false };
const otherManagerSession = { id: 4, name: "他部署 上長", email: "other@test.com", is_manager: true };

// 日報stub: salespersonId=2, managerId=1
const reportStub = {
  salespersonId: 2,
  salesperson: { managerId: 1, name: "山田 太郎" },
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeGetReq(path: string) {
  return new NextRequest(`${BASE_URL}${path}`);
}

function makePostReq(path: string, body: unknown = {}) {
  return new NextRequest(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePutReq(path: string, body: unknown = {}) {
  return new NextRequest(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── PRIV-001：エンドポイント別権限確認 ────────────────────────────────────────

describe("PRIV-001: 営業ユーザーが manager-only エンドポイントにアクセスすると 403", () => {
  test("GET /salespersons → 403 FORBIDDEN (PRIV-001-9)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await salespersonsGET(makeGetReq("/api/salespersons"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("POST /salespersons → 403 FORBIDDEN (PRIV-001-10)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await salespersonsPOST(
      makePostReq("/api/salespersons", { name: "test", email: "t@t.com", password: "pass1234", is_manager: false, manager_id: 1 }),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("PUT /salespersons/:id → 403 FORBIDDEN (PRIV-001-11)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await salespersonDetailPUT(
      makePutReq("/api/salespersons/2", { name: "test", email: "t@t.com", is_manager: false, manager_id: 1 }),
      makeParams("2"),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("POST /customers → 403 FORBIDDEN (PRIV-001-7)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await customersPOST(
      makePostReq("/api/customers", { name: "顧客A", company: "会社A", assigned_salesperson_id: 2 }),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("PUT /customers/:id → 403 FORBIDDEN (PRIV-001-8)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await customerDetailPUT(
      makePutReq("/api/customers/10", { name: "顧客A", company: "会社A", assigned_salesperson_id: 2 }),
      makeParams("10"),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("POST /reports/:id/comments → 403 FORBIDDEN (PRIV-001-5, 営業ユーザー)", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await commentsPOST(
      makePostReq("/api/reports/101/comments", { target_type: "problem", content: "コメント" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("PRIV-001: 上長ユーザーが sales-only エンドポイントにアクセスすると 403", () => {
  test("POST /reports → 403 FORBIDDEN (PRIV-001-3, 上長)", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await reportsPOST(
      makePostReq("/api/reports", {
        report_date: "2026-04-10",
        visit_records: [{ customer_id: 1, visit_content: "訪問", visit_order: 1 }],
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("PUT /reports/:id → 403 FORBIDDEN (PRIV-001-4, 上長)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockReportFindUnique.mockResolvedValue({ salespersonId: 2 });

    const res = await reportDetailPUT(
      makePutReq("/api/reports/101", {
        report_date: "2026-04-10",
        visit_records: [{ customer_id: 1, visit_content: "訪問", visit_order: 1 }],
      }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("PRIV-001: 営業ユーザーが他人のリソースにアクセスすると 403", () => {
  test("GET /reports/:id (他人の日報) → 403 FORBIDDEN (PRIV-001-2)", async () => {
    mockGetSession.mockResolvedValue(otherSalesSession); // id=3
    mockReportFindUnique.mockResolvedValue({
      ...reportStub,
      id: 101,
      reportDate: new Date("2026-04-10"),
      problem: null,
      plan: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      visitRecords: [],
      comments: [],
    });

    const res = await reportDetailGET(makeGetReq("/api/reports/101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("PUT /reports/:id (他人の日報) → 403 FORBIDDEN (PRIV-001-4)", async () => {
    mockGetSession.mockResolvedValue(otherSalesSession); // id=3
    mockReportFindUnique.mockResolvedValue({ salespersonId: 2 }); // owner=2 ≠ 3

    const res = await reportDetailPUT(
      makePutReq("/api/reports/101", {
        report_date: "2026-04-10",
        visit_records: [{ customer_id: 1, visit_content: "訪問", visit_order: 1 }],
      }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("PRIV-001: 上長が配下外のリソースにアクセスすると 403", () => {
  test("GET /reports/:id (配下外) → 403 FORBIDDEN (PRIV-001-2)", async () => {
    mockGetSession.mockResolvedValue(otherManagerSession); // id=4, managerId of report=1
    mockReportFindUnique.mockResolvedValue({
      ...reportStub,
      id: 101,
      reportDate: new Date("2026-04-10"),
      problem: null,
      plan: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      visitRecords: [],
      comments: [],
    });

    const res = await reportDetailGET(makeGetReq("/api/reports/101"), makeParams("101"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("POST /reports/:id/comments (配下外) → 403 FORBIDDEN (PRIV-001-5)", async () => {
    mockGetSession.mockResolvedValue(otherManagerSession); // id=4
    mockReportFindUnique.mockResolvedValue({ salesperson: { managerId: 1 } }); // managerId=1 ≠ 4

    const res = await commentsPOST(
      makePostReq("/api/reports/101/comments", { target_type: "problem", content: "コメント" }),
      makeParams("101"),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("PRIV-001: 正常アクセス（○パターン）", () => {
  test("GET /customers は営業ユーザーもアクセスできる (PRIV-001-6)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockCustomerCount.mockResolvedValue(0);
    mockCustomerFindMany.mockResolvedValue([]);

    const res = await customersGET(makeGetReq("/api/customers"));
    expect(res.status).toBe(200);
  });

  test("GET /customers は上長もアクセスできる (PRIV-001-6)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockCustomerCount.mockResolvedValue(0);
    mockCustomerFindMany.mockResolvedValue([]);

    const res = await customersGET(makeGetReq("/api/customers"));
    expect(res.status).toBe(200);
  });

  test("GET /reports は営業ユーザーがアクセスできる (PRIV-001-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockReportCount.mockResolvedValue(0);
    mockReportFindMany.mockResolvedValue([]);

    const res = await reportsGET(makeGetReq("/api/reports"));
    expect(res.status).toBe(200);
  });

  test("GET /reports は上長もアクセスできる (PRIV-001-1)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockSalespersonFindMany.mockResolvedValue([]);
    mockReportCount.mockResolvedValue(0);
    mockReportFindMany.mockResolvedValue([]);

    const res = await reportsGET(makeGetReq("/api/reports"));
    expect(res.status).toBe(200);
  });
});

// ── PRIV-002：未認証アクセス ──────────────────────────────────────────────────

describe("PRIV-002: 未認証アクセス", () => {
  test("Authorization ヘッダーなしで 401 UNAUTHORIZED (PRIV-002-1)", async () => {
    const req = new NextRequest(`${BASE_URL}/api/reports`);
    const res = await proxy(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("不正なトークンで 401 UNAUTHORIZED (PRIV-002-2)", async () => {
    const req = new NextRequest(`${BASE_URL}/api/reports`, {
      headers: { Authorization: "Bearer invalid.token.value" },
    });
    const res = await proxy(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("期限切れトークンで 401 UNAUTHORIZED (PRIV-002-3)", async () => {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({
      sub: "2",
      name: "山田 太郎",
      email: "yamada@test.com",
      is_manager: false,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 3600)
      .sign(secret);

    const req = new NextRequest(`${BASE_URL}/api/reports`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const res = await proxy(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
