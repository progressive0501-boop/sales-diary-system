import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "../_components/LoginForm";

// ── モック ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function stubFetchOk() {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: { token: "t" } }), {
      status: 200,
    }),
  );
}

function stubFetchUnauthorized() {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        success: false,
        error: { code: "UNAUTHORIZED", message: "..." },
      }),
      { status: 401 },
    ),
  );
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("LoginForm - バリデーション", () => {
  test("メールアドレス未入力で「メールアドレスを入力してください」が表示される", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスを入力してください"),
      ).toBeInTheDocument();
    });
  });

  test("パスワード未入力で「パスワードを入力してください」が表示される", async () => {
    render(<LoginForm />);
    await userEvent.type(
      screen.getByLabelText("メールアドレス"),
      "user@example.com",
    );
    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(
        screen.getByText("パスワードを入力してください"),
      ).toBeInTheDocument();
    });
  });

  test("メールアドレスの形式が不正な場合エラーメッセージが表示される", async () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText("メールアドレス");
    fireEvent.change(emailInput, { target: { value: "not-email" } });
    // ボタンクリックではなく form の submit を直接発火して react-hook-form のバリデーションを実行
    fireEvent.submit(emailInput.closest("form")!);

    await waitFor(() => {
      expect(
        screen.getByText("メールアドレスの形式が正しくありません"),
      ).toBeInTheDocument();
    });
  });
});

describe("LoginForm - 認証失敗", () => {
  test("API が 401 を返したとき認証失敗メッセージが表示される", async () => {
    stubFetchUnauthorized();
    render(<LoginForm />);

    await userEvent.type(
      screen.getByLabelText("メールアドレス"),
      "user@example.com",
    );
    await userEvent.type(screen.getByLabelText("パスワード"), "WrongPass!");
    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "メールアドレスまたはパスワードが正しくありません",
        ),
      ).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("LoginForm - 認証成功", () => {
  test("API が 200 を返したときダッシュボードへ遷移する", async () => {
    stubFetchOk();
    render(<LoginForm />);

    await userEvent.type(
      screen.getByLabelText("メールアドレス"),
      "yamada@test.com",
    );
    await userEvent.type(screen.getByLabelText("パスワード"), "Test1234!");
    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  test("認証成功後にエラーメッセージは表示されない", async () => {
    stubFetchOk();
    render(<LoginForm />);

    await userEvent.type(
      screen.getByLabelText("メールアドレス"),
      "yamada@test.com",
    );
    await userEvent.type(screen.getByLabelText("パスワード"), "Test1234!");
    await userEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
    expect(
      screen.queryByText("メールアドレスまたはパスワードが正しくありません"),
    ).not.toBeInTheDocument();
  });
});

describe("LoginForm - UI", () => {
  test("パスワードフィールドは type=password でマスク表示", () => {
    render(<LoginForm />);
    const passwordInput = screen.getByLabelText("パスワード");
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
