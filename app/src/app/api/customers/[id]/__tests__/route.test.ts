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
    customer: { findUnique: mockFindUnique },
  },
}));

import { GET } from "../route";

// ── テスト用データ ────────────────────────────────────────────────────────────

const salesSession = { id: 2, name: "山田 太郎", email: "yamada@test.com", is_manager: false };

const BASE_URL = "http://localhost:3000";

const customerStub = {
  id: 10,
  name: "田中 一郎",
  company: "株式会社A",
  phone: "03-1234-5678",
  address: "東京都千代田区",
  assignedSalespersonId: 2,
  assignedSalesperson: { name: "山田 太郎" },
};

function makeRequest(id: string) {
  return new NextRequest(`${BASE_URL}/api/customers/${id}`);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── CST-002：顧客詳細取得 ──────────────────────────────────────────────────────

describe("GET /api/customers/[id] - 正常系 (CST-002)", () => {
  test("顧客詳細を正常取得できる (CST-002-1)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(customerStub);

    const res = await GET(makeRequest("10"), makeParams("10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: 10,
      name: "田中 一郎",
      company: "株式会社A",
      phone: "03-1234-5678",
      address: "東京都千代田区",
      assigned_salesperson_id: 2,
      assigned_salesperson_name: "山田 太郎",
    });
  });

  test("phone・address が null の顧客も正常に返る", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue({ ...customerStub, phone: null, address: null });

    const res = await GET(makeRequest("10"), makeParams("10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.phone).toBeNull();
    expect(body.data.address).toBeNull();
  });
});

describe("GET /api/customers/[id] - 404 / 401", () => {
  test("存在しない顧客IDで 404 NOT_FOUND (CST-002-2)", async () => {
    mockGetSession.mockResolvedValue(salesSession);
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest("9999"), makeParams("9999"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("数値でないIDで 404 NOT_FOUND", async () => {
    mockGetSession.mockResolvedValue(salesSession);

    const res = await GET(makeRequest("abc"), makeParams("abc"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("未認証で 401 UNAUTHORIZED が返る", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest("10"), makeParams("10"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
