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
  prisma: {
    salesperson: { findUnique: mockFindUnique },
  },
}));

import { GET } from "../route";

// ── テスト用データ ────────────────────────────────────────────────────────────

const salesSession = { id: 2, name: "山田 太郎", email: "yamada@test.com", is_manager: false };
const managerSession = { id: 1, name: "鈴木 部長", email: "suzuki@test.com", is_manager: true };

const BASE_URL = "http://localhost:3000";

const salespersonStub = {
  id: 2,
  name: "山田 太郎",
  email: "yamada@test.com",
  department: "東日本営業部",
  isManager: false,
  managerId: 1,
  manager: { name: "鈴木 部長" },
};

function makeRequest(id: string) {
  return new NextRequest(`${BASE_URL}/api/salespersons/${id}`);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── SLS-001：営業詳細取得 ──────────────────────────────────────────────────────

describe("GET /api/salespersons/[id] - 正常系 (SLS-001)", () => {
  test("上長が営業詳細を正常取得できる (SLS-001-3)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(salespersonStub);

    const res = await GET(makeRequest("2"), makeParams("2"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: 2,
      name: "山田 太郎",
      email: "yamada@test.com",
      department: "東日本営業部",
      is_manager: false,
      manager_id: 1,
      manager_name: "鈴木 部長",
    });
  });

  test("manager が null の営業詳細も正常に返る", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue({
      ...salespersonStub,
      isManager: true,
      managerId: null,
      manager: null,
    });

    const res = await GET(makeRequest("1"), makeParams("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.manager_id).toBeNull();
    expect(body.data.manager_name).toBeNull();
  });
});

describe("GET /api/salespersons/[id] - 404 / 403 / 401 (SLS-001)", () => {
  test("存在しない営業IDで 404 NOT_FOUND (SLS-001-4)", async () => {
    mockGetSession.mockResolvedValue(managerSession);
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("9999"), makeParams("9999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("数値でないIDで 404 NOT_FOUND", async () => {
    mockGetSession.mockResolvedValue(managerSession);

    const res = await GET(makeRequest("abc"), makeParams("abc"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("営業ユーザーが詳細取得すると 403 FORBIDDEN", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await GET(makeRequest("2"), makeParams("2"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("未認証で 401 UNAUTHORIZED が返る", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest("2"), makeParams("2"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
