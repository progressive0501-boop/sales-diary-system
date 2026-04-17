// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";

// ── モック ────────────────────────────────────────────────────────────────────

const { mockCookieDelete } = vi.hoisted(() => ({
  mockCookieDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ delete: mockCookieDelete }),
}));

import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── テスト ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  test('200 OK と { success: true, data: null } を返す', async () => {
    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: null });
  });

  test("Cookie の token を削除する", async () => {
    await POST();

    expect(mockCookieDelete).toHaveBeenCalledWith("token");
    expect(mockCookieDelete).toHaveBeenCalledTimes(1);
  });
});

