/**
 * SCR-T-003：日報作成画面
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateReportForm } from "../CreateReportForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

const TODAY = "2026-04-21";
const CUSTOMERS = [
  { id: 10, name: "佐藤 一郎", company: "株式会社A" },
  { id: 11, name: "中村 花子", company: "株式会社B" },
];

function stubFetchOk(reportId = 103) {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({ data: { id: reportId } }),
      { status: 201 },
    ),
  );
}

function stubFetchConflict() {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({ error: { code: "CONFLICT", message: "重複" } }),
      { status: 409 },
    ),
  );
}

describe("SCR-T-003-9: 対象日の自動セット", () => {
  test("対象日に today プロップの値が表示される", () => {
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    expect(screen.getByText(`対象日：${TODAY}（本日）`)).toBeInTheDocument();
  });
});

describe("SCR-T-003-3: 訪問先の追加", () => {
  test("「訪問先を追加する」をクリックすると入力行が1行増える", async () => {
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    const deleteButtons = screen.getAllByRole("button", { name: /訪問記録.*を削除/ });
    expect(deleteButtons).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /訪問先を追加する/ }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /訪問記録.*を削除/ })).toHaveLength(2);
    });
  });
});

describe("SCR-T-003-5: 訪問先が1行の時の削除ボタン", () => {
  test("訪問記録が1行のみの時、削除ボタンが非活性になっている", () => {
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    const deleteButton = screen.getByRole("button", { name: "訪問記録1を削除" });
    expect(deleteButton).toBeDisabled();
  });
});

describe("SCR-T-003-4: 訪問先の削除", () => {
  test("2行あるときに2行目の削除ボタンをクリックすると1行に減る", async () => {
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    await userEvent.click(screen.getByRole("button", { name: /訪問先を追加する/ }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /訪問記録.*を削除/ })).toHaveLength(2);
    });

    await userEvent.click(screen.getByRole("button", { name: "訪問記録2を削除" }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /訪問記録.*を削除/ })).toHaveLength(1);
    });
  });
});

describe("SCR-T-003-6: 顧客未選択でバリデーション", () => {
  test("顧客を選択せずに保存すると「顧客を選択してください」が表示される", async () => {
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("顧客を選択してください")).toBeInTheDocument();
    });
  });
});

describe("SCR-T-003-7: 訪問内容未入力でバリデーション", () => {
  test("訪問内容を空にして保存すると「訪問内容を入力してください」が表示される", async () => {
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("訪問内容を入力してください")).toBeInTheDocument();
    });
  });
});

describe("SCR-T-003-8: キャンセルボタン", () => {
  test("キャンセルをクリックするとダッシュボードへ戻る", async () => {
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mockPush).toHaveBeenCalledWith("/");
  });
});

describe("SCR-T-003-1: 日報の正常作成", () => {
  test("全項目入力して保存するとAPIが呼ばれ詳細画面へ遷移する", async () => {
    stubFetchOk(103);
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    // 顧客を選択（Selectコンポーネントはcomboboxとして認識される）
    const comboboxes = screen.getAllByRole("combobox");
    await userEvent.click(comboboxes[0]);
    await userEvent.click(screen.getByRole("option", { name: /株式会社A/ }));

    // 訪問内容を入力
    const textareas = screen.getAllByPlaceholderText("訪問内容を入力");
    await userEvent.type(textareas[0], "提案実施");

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/reports/103");
    });
  });
});

describe("SCR-T-003-2: Problem・Plan省略での作成", () => {
  test("Problem・Planを空にして保存しても正常に処理される", async () => {
    stubFetchOk(104);
    render(<CreateReportForm today={TODAY} customers={CUSTOMERS} />);

    const comboboxes = screen.getAllByRole("combobox");
    await userEvent.click(comboboxes[0]);
    await userEvent.click(screen.getByRole("option", { name: /株式会社A/ }));

    const textareas = screen.getAllByPlaceholderText("訪問内容を入力");
    await userEvent.type(textareas[0], "テスト訪問");

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/reports",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/reports/104");
    });
  });
});
