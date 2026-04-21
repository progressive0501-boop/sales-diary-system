/**
 * SCR-T-004：日報詳細・編集画面
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportDetailClient } from "../ReportDetailClient";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

const CUSTOMERS = [
  { id: 10, name: "佐藤 一郎", company: "株式会社A" },
  { id: 11, name: "中村 花子", company: "株式会社B" },
];

const BASE_REPORT = {
  id: 101,
  salesperson_id: 2,
  salesperson_name: "山田 太郎",
  report_date: "2026-04-10",
  problem: "テスト課題",
  plan: "テスト計画",
  visit_records: [
    {
      id: 201,
      customer_id: 10,
      customer_name: "佐藤 一郎",
      customer_company: "株式会社A",
      visit_content: "提案実施",
      visit_order: 1,
    },
  ],
  comments: {
    problem: [
      {
        id: 301,
        commenter_id: 1,
        commenter_name: "鈴木 部長",
        content: "標準条件で対応してください",
        created_at: "2026-04-10T10:00:00Z",
      },
    ],
    plan: [],
  },
};

function stubFetchPutOk() {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({ data: { id: 101, updated_at: "2026-04-10T11:00:00Z" } }),
      { status: 200 },
    ),
  );
}

function stubFetchCommentOk() {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        data: {
          id: 302,
          commenter_id: 1,
          commenter_name: "鈴木 部長",
          content: "新しいコメント",
          created_at: "2026-04-10T12:00:00Z",
        },
      }),
      { status: 201 },
    ),
  );
}

describe("SCR-T-004-1: 作成者による詳細表示", () => {
  test("訪問記録・Problem・Planが表示され、編集ボタンが表示される", () => {
    render(
      <ReportDetailClient
        report={BASE_REPORT}
        isOwner={true}
        isManager={false}
        customers={CUSTOMERS}
      />,
    );

    expect(screen.getByText("提案実施")).toBeInTheDocument();
    expect(screen.getByText("テスト課題")).toBeInTheDocument();
    expect(screen.getByText("テスト計画")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "編集する" })).toBeInTheDocument();
  });
});

describe("SCR-T-004-2: 上長による詳細表示", () => {
  test("編集ボタンが表示されず、コメント入力欄が表示される", () => {
    render(
      <ReportDetailClient
        report={BASE_REPORT}
        isOwner={false}
        isManager={true}
        customers={CUSTOMERS}
      />,
    );

    expect(screen.queryByRole("button", { name: "編集する" })).not.toBeInTheDocument();
    // ProblemとPlanの両方にコメント欄があるため getAllBy を使う
    const commentTextareas = screen.getAllByPlaceholderText("コメントを入力...");
    expect(commentTextareas.length).toBeGreaterThanOrEqual(1);
    const postButtons = screen.getAllByRole("button", { name: "投稿" });
    expect(postButtons.length).toBeGreaterThanOrEqual(1);
  });
});

describe("SCR-T-004-3: 編集モードへの切り替え", () => {
  test("編集ボタンをクリックすると各フィールドが編集可能になる", async () => {
    render(
      <ReportDetailClient
        report={BASE_REPORT}
        isOwner={true}
        isManager={false}
        customers={CUSTOMERS}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "編集する" }));

    await waitFor(() => {
      expect(screen.getByText("日報編集")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "保存する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  });
});

describe("SCR-T-004-5: 編集をキャンセル", () => {
  test("キャンセルボタンを押すと表示モードに戻る", async () => {
    render(
      <ReportDetailClient
        report={BASE_REPORT}
        isOwner={true}
        isManager={false}
        customers={CUSTOMERS}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "編集する" }));
    await waitFor(() => {
      expect(screen.getByText("日報編集")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    await waitFor(() => {
      expect(screen.queryByText("日報編集")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "編集する" })).toBeInTheDocument();
    });
  });
});

describe("SCR-T-004-4: 編集して保存", () => {
  test("保存ボタンを押すと変更が反映されて表示モードに戻る", async () => {
    stubFetchPutOk();
    render(
      <ReportDetailClient
        report={BASE_REPORT}
        isOwner={true}
        isManager={false}
        customers={CUSTOMERS}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "編集する" }));
    await waitFor(() => {
      expect(screen.getByText("日報編集")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/reports/101",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "編集する" })).toBeInTheDocument();
    });
  });
});

describe("SCR-T-004-6: Problemへのコメント投稿", () => {
  test("コメントを入力して投稿するとコメントが一覧に追加され入力欄がクリアされる", async () => {
    stubFetchCommentOk();
    render(
      <ReportDetailClient
        report={{ ...BASE_REPORT, comments: { problem: [], plan: [] } }}
        isOwner={false}
        isManager={true}
        customers={CUSTOMERS}
      />,
    );

    const textareas = screen.getAllByPlaceholderText("コメントを入力...");
    await userEvent.type(textareas[0], "新しいコメント");
    await userEvent.click(screen.getAllByRole("button", { name: "投稿" })[0]);

    await waitFor(() => {
      expect(screen.getByText("新しいコメント")).toBeInTheDocument();
    });
    expect(textareas[0]).toHaveValue("");
  });
});

describe("SCR-T-004-8: コメント欄が営業に非表示", () => {
  test("isManager=false のとき、コメント入力欄・投稿ボタンが表示されない", () => {
    render(
      <ReportDetailClient
        report={BASE_REPORT}
        isOwner={true}
        isManager={false}
        customers={CUSTOMERS}
      />,
    );

    expect(screen.queryByPlaceholderText("コメントを入力...")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "投稿" })).not.toBeInTheDocument();
  });
});

describe("SCR-T-004-9: コメント未入力で投稿", () => {
  test("コメントを空のまま投稿すると「コメントを入力してください」が表示される", async () => {
    render(
      <ReportDetailClient
        report={{ ...BASE_REPORT, comments: { problem: [], plan: [] } }}
        isOwner={false}
        isManager={true}
        customers={CUSTOMERS}
      />,
    );

    await userEvent.click(screen.getAllByRole("button", { name: "投稿" })[0]);

    await waitFor(() => {
      expect(screen.getByText("コメントを入力してください")).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
