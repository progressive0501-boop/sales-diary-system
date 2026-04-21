/**
 * SCR-T-005：顧客マスタ画面（一覧部分）
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerListClient } from "../CustomerListClient";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

const PAGINATION = { total: 2, total_pages: 1, current_page: 1, per_page: 20 };

const CUSTOMERS = [
  { id: 10, name: "佐藤 一郎", company: "株式会社A", assigned_salesperson_name: "山田 太郎" },
  { id: 11, name: "中村 花子", company: "株式会社B", assigned_salesperson_name: "山田 太郎" },
];

function stubFetchCustomers(items: typeof CUSTOMERS) {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          items,
          pagination: { ...PAGINATION, total: items.length },
        },
      }),
      { status: 200 },
    ),
  );
}

describe("SCR-T-005-1: 顧客一覧の表示", () => {
  test("顧客名・会社名・担当営業が一覧表示される", () => {
    render(
      <CustomerListClient
        isManager={true}
        initialItems={CUSTOMERS}
        initialPagination={PAGINATION}
      />,
    );

    expect(screen.getByText("佐藤 一郎")).toBeInTheDocument();
    expect(screen.getByText("株式会社A")).toBeInTheDocument();
    expect(screen.getAllByText("山田 太郎")).toHaveLength(2);
  });
});

describe("SCR-T-005-2: キーワード検索", () => {
  test("検索テキストを入力して検索するとfetchが呼ばれる", async () => {
    stubFetchCustomers([CUSTOMERS[0]]);
    render(
      <CustomerListClient
        isManager={true}
        initialItems={CUSTOMERS}
        initialPagination={PAGINATION}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText("顧客名・会社名..."), "株式会社A");
    await userEvent.click(screen.getByRole("button", { name: "検索" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/customers\?.*q=/),
      );
    });
  });
});

describe("SCR-T-005-5: 営業による新規登録ボタン非表示", () => {
  test("isManager=false のとき新規登録ボタンが表示されない", () => {
    render(
      <CustomerListClient
        isManager={false}
        initialItems={CUSTOMERS}
        initialPagination={PAGINATION}
      />,
    );

    expect(screen.queryByRole("button", { name: /新規登録/ })).not.toBeInTheDocument();
  });

  test("isManager=true のとき新規登録ボタンが表示される", () => {
    render(
      <CustomerListClient
        isManager={true}
        initialItems={CUSTOMERS}
        initialPagination={PAGINATION}
      />,
    );

    expect(screen.getByRole("button", { name: /新規登録/ })).toBeInTheDocument();
  });
});
