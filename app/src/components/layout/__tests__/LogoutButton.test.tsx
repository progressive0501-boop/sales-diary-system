import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogoutButton } from "../LogoutButton";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
  });

  test("ログアウトボタンが表示される", () => {
    render(<LogoutButton />);
    expect(
      screen.getByRole("button", { name: "ログアウト" }),
    ).toBeInTheDocument();
  });

  test("ボタン押下でPOST /api/auth/logoutを呼び出す", async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  test("ボタン押下後に/loginへリダイレクトされる", async () => {
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});
