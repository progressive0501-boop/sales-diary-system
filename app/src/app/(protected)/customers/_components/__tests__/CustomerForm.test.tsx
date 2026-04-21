/**
 * SCR-T-005：顧客マスタ画面（登録・編集フォーム部分）
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerForm } from "../CustomerForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

const SALESPERSONS = [
  { id: 2, name: "山田 太郎" },
  { id: 3, name: "田中 次郎" },
];

function stubFetchOk() {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ data: {} }), { status: 201 }),
  );
}

function stubFetchOkPut() {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ data: {} }), { status: 200 }),
  );
}

describe("SCR-T-005-3: 顧客登録（上長）", () => {
  test("全項目入力して保存すると一覧画面へ遷移する", async () => {
    stubFetchOk();
    render(<CustomerForm mode="new" salespersons={SALESPERSONS} />);

    await userEvent.type(screen.getByLabelText("顧客名 *"), "新規顧客");
    await userEvent.type(screen.getByLabelText("会社名 *"), "新規会社");

    const combobox = screen.getByRole("combobox");
    await userEvent.click(combobox);
    await userEvent.click(screen.getByRole("option", { name: "山田 太郎" }));

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/customers");
    });
  });
});

describe("SCR-T-005-4: 顧客編集（上長）", () => {
  test("内容を変更して保存すると変更が反映されて一覧へ遷移する", async () => {
    stubFetchOkPut();
    render(
      <CustomerForm
        mode="edit"
        customerId={10}
        salespersons={SALESPERSONS}
        defaultValues={{
          name: "佐藤 一郎",
          company: "株式会社A",
          phone: "",
          address: "",
          assigned_salesperson_id: "2",
        }}
      />,
    );

    const nameInput = screen.getByLabelText("顧客名 *");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "佐藤 更新");

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/customers/10",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/customers");
    });
  });
});

describe("SCR-T-005-6: 必須項目未入力で保存", () => {
  test("顧客名を空にして保存するとエラーメッセージが表示される", async () => {
    render(<CustomerForm mode="new" salespersons={SALESPERSONS} />);

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(screen.getByText("顧客名を入力してください")).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
