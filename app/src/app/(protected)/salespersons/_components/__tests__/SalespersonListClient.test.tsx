/**
 * SCR-T-006：営業マスタ画面（一覧部分）
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SalespersonListClient } from "../SalespersonListClient";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

const PAGINATION = { total: 2, total_pages: 1, current_page: 1, per_page: 20 };

const SALESPERSONS = [
  { id: 2, name: "山田 太郎", email: "yamada@test.com", manager_name: "鈴木 部長" },
  { id: 3, name: "田中 次郎", email: "tanaka@test.com", manager_name: "鈴木 部長" },
];

describe("SCR-T-006-1: 営業一覧の表示", () => {
  test("氏名・メールアドレス・上長名が一覧表示される", () => {
    render(
      <SalespersonListClient
        initialItems={SALESPERSONS}
        initialPagination={PAGINATION}
      />,
    );

    expect(screen.getByText("山田 太郎")).toBeInTheDocument();
    expect(screen.getByText("yamada@test.com")).toBeInTheDocument();
    expect(screen.getAllByText("鈴木 部長")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "氏名" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "メールアドレス" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "上長" })).toBeInTheDocument();
  });
});
