/**
 * SCR-T-006：営業マスタ画面（登録・編集フォーム部分）
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SalespersonForm } from "../SalespersonForm";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

const MANAGERS = [{ id: 1, name: "鈴木 部長" }];

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

function stubFetchConflict() {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        error: { code: "CONFLICT", message: "このメールアドレスは既に使用されています" },
      }),
      { status: 409 },
    ),
  );
}

describe("SCR-T-006-2: 営業登録", () => {
  test("全項目入力して保存すると一覧画面へ遷移する", async () => {
    stubFetchOk();
    render(<SalespersonForm mode="new" managers={MANAGERS} />);

    await userEvent.type(screen.getByLabelText("氏名 *"), "新田 三郎");
    await userEvent.type(screen.getByLabelText("メールアドレス *"), "nitta@test.com");
    await userEvent.type(screen.getByLabelText("パスワード *"), "NewPass123!");

    const combobox = screen.getByRole("combobox");
    await userEvent.click(combobox);
    await userEvent.click(screen.getByRole("option", { name: "鈴木 部長" }));

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/salespersons");
    });
  });
});

describe("SCR-T-006-3: 営業編集", () => {
  test("内容を変更して保存すると変更が反映されて一覧へ遷移する", async () => {
    stubFetchOkPut();
    render(
      <SalespersonForm
        mode="edit"
        salespersonId={2}
        managers={MANAGERS}
        defaultValues={{
          name: "山田 太郎",
          email: "yamada@test.com",
          department: "",
          manager_id: "1",
          is_manager: "false",
        }}
      />,
    );

    const nameInput = screen.getByLabelText("氏名 *");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "山田 更新");

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/salespersons/2",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/salespersons");
    });
  });
});

describe("SCR-T-006-5: メールアドレス重複", () => {
  test("既存のメールアドレスで登録するとエラーメッセージが表示される", async () => {
    stubFetchConflict();
    render(<SalespersonForm mode="new" managers={MANAGERS} />);

    await userEvent.type(screen.getByLabelText("氏名 *"), "重複 太郎");
    await userEvent.type(screen.getByLabelText("メールアドレス *"), "yamada@test.com");
    await userEvent.type(screen.getByLabelText("パスワード *"), "Test1234!");

    const combobox = screen.getByRole("combobox");
    await userEvent.click(combobox);
    await userEvent.click(screen.getByRole("option", { name: "鈴木 部長" }));

    await userEvent.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(
        screen.getByText("このメールアドレスは既に使用されています"),
      ).toBeInTheDocument();
    });
  });
});
