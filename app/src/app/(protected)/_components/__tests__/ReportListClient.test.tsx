/**
 * SCR-T-002：ダッシュボード（日報一覧）
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportListClient } from "../ReportListClient";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

const PAGINATION = { total: 2, total_pages: 1, current_page: 1, per_page: 20 };

const REPORT_YAMADA = {
  id: 101,
  salesperson_id: 2,
  salesperson_name: "山田 太郎",
  report_date: "2026-04-10",
  visit_count: 2,
  has_comment: true,
};

const REPORT_TANAKA = {
  id: 102,
  salesperson_id: 3,
  salesperson_name: "田中 次郎",
  report_date: "2026-04-10",
  visit_count: 1,
  has_comment: false,
};

const SALESPERSON_OPTIONS = [
  { id: 2, name: "山田 太郎" },
  { id: 3, name: "田中 次郎" },
];

function stubFetchReports(items: typeof REPORT_YAMADA[]) {
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

describe("SCR-T-002-1: 営業ログイン時の一覧表示", () => {
  test("自分の日報のみ表示され、新規日報作成ボタンが表示される", () => {
    render(
      <ReportListClient
        isManager={false}
        initialItems={[REPORT_YAMADA]}
        initialPagination={{ ...PAGINATION, total: 1 }}
        initialSalespersonOptions={[]}
      />,
    );

    expect(screen.getByText("2026-04-10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新規日報作成/ })).toBeInTheDocument();
  });

  test("営業名列は表示されない", () => {
    render(
      <ReportListClient
        isManager={false}
        initialItems={[REPORT_YAMADA]}
        initialPagination={{ ...PAGINATION, total: 1 }}
        initialSalespersonOptions={[]}
      />,
    );

    expect(screen.queryByRole("columnheader", { name: "営業名" })).not.toBeInTheDocument();
  });
});

describe("SCR-T-002-2: 上長ログイン時の一覧表示", () => {
  test("配下全員の日報が表示され、営業名フィルターが表示される", () => {
    render(
      <ReportListClient
        isManager={true}
        initialItems={[REPORT_YAMADA, REPORT_TANAKA]}
        initialPagination={PAGINATION}
        initialSalespersonOptions={SALESPERSON_OPTIONS}
      />,
    );

    expect(screen.getByText("山田 太郎")).toBeInTheDocument();
    expect(screen.getByText("田中 次郎")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "営業名" })).toBeInTheDocument();
    // 営業名フィルターはSelectコンポーネント（combobox）として表示される
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  });

  test("新規日報作成ボタンは表示されない", () => {
    render(
      <ReportListClient
        isManager={true}
        initialItems={[REPORT_YAMADA]}
        initialPagination={PAGINATION}
        initialSalespersonOptions={SALESPERSON_OPTIONS}
      />,
    );

    expect(screen.queryByRole("button", { name: /新規日報作成/ })).not.toBeInTheDocument();
  });
});

describe("SCR-T-002-3: 年月フィルター", () => {
  test("検索ボタン押下でfetchが呼ばれる", async () => {
    stubFetchReports([REPORT_YAMADA]);
    render(
      <ReportListClient
        isManager={false}
        initialItems={[REPORT_YAMADA]}
        initialPagination={{ ...PAGINATION, total: 1 }}
        initialSalespersonOptions={[]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "検索" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/reports"),
      );
    });
  });
});

describe("SCR-T-002-5: 日報行クリックで詳細遷移", () => {
  test("日報行をクリックすると詳細画面へ遷移する", async () => {
    render(
      <ReportListClient
        isManager={false}
        initialItems={[REPORT_YAMADA]}
        initialPagination={{ ...PAGINATION, total: 1 }}
        initialSalespersonOptions={[]}
      />,
    );

    await userEvent.click(screen.getByText("2026-04-10"));

    expect(mockPush).toHaveBeenCalledWith("/reports/101");
  });
});

describe("SCR-T-002-6: 新規日報作成ボタン", () => {
  test("新規日報作成ボタンをクリックすると作成画面へ遷移する", async () => {
    render(
      <ReportListClient
        isManager={false}
        initialItems={[]}
        initialPagination={{ ...PAGINATION, total: 0 }}
        initialSalespersonOptions={[]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /新規日報作成/ }));

    expect(mockPush).toHaveBeenCalledWith("/reports/new");
  });
});

describe("SCR-T-002-7: コメント有無の表示", () => {
  test("has_comment=true の行には「あり」が表示される", () => {
    render(
      <ReportListClient
        isManager={false}
        initialItems={[REPORT_YAMADA]}
        initialPagination={{ ...PAGINATION, total: 1 }}
        initialSalespersonOptions={[]}
      />,
    );

    expect(screen.getByText("あり")).toBeInTheDocument();
  });

  test("has_comment=false の行には「なし」が表示される", () => {
    render(
      <ReportListClient
        isManager={true}
        initialItems={[REPORT_TANAKA]}
        initialPagination={{ ...PAGINATION, total: 1 }}
        initialSalespersonOptions={SALESPERSON_OPTIONS}
      />,
    );

    expect(screen.getByText("なし")).toBeInTheDocument();
  });
});
