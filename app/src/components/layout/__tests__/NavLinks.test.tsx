import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import * as nextNavigation from "next/navigation";
import { NavLinks } from "../NavLinks";

// usePathnameをモック
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/reports"),
}));

// next/linkをモック（テスト環境でのルーター不要）
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockUsePathname = vi.mocked(nextNavigation.usePathname);

describe("NavLinks", () => {
  describe("営業ユーザー（isManager: false）", () => {
    test("日報一覧リンクが表示される", () => {
      mockUsePathname.mockReturnValue("/reports");
      render(<NavLinks isManager={false} />);
      expect(screen.getByText("日報一覧")).toBeInTheDocument();
    });

    test("顧客マスタリンクが表示される", () => {
      mockUsePathname.mockReturnValue("/reports");
      render(<NavLinks isManager={false} />);
      expect(screen.getByText("顧客マスタ")).toBeInTheDocument();
    });

    test("営業マスタリンクが表示されない", () => {
      mockUsePathname.mockReturnValue("/reports");
      render(<NavLinks isManager={false} />);
      expect(screen.queryByText("営業マスタ")).not.toBeInTheDocument();
    });
  });

  describe("上長ユーザー（isManager: true）", () => {
    test("日報一覧リンクが表示される", () => {
      mockUsePathname.mockReturnValue("/reports");
      render(<NavLinks isManager={true} />);
      expect(screen.getByText("日報一覧")).toBeInTheDocument();
    });

    test("顧客マスタリンクが表示される", () => {
      mockUsePathname.mockReturnValue("/reports");
      render(<NavLinks isManager={true} />);
      expect(screen.getByText("顧客マスタ")).toBeInTheDocument();
    });

    test("営業マスタリンクが表示される", () => {
      mockUsePathname.mockReturnValue("/reports");
      render(<NavLinks isManager={true} />);
      expect(screen.getByText("営業マスタ")).toBeInTheDocument();
    });
  });

  describe("アクティブリンクのスタイル", () => {
    test("現在のパスに対応するリンクにaria-current=pageが設定される", () => {
      mockUsePathname.mockReturnValue("/reports");
      render(<NavLinks isManager={false} />);

      const reportsLink = screen.getByText("日報一覧").closest("a");
      expect(reportsLink).toHaveAttribute("aria-current", "page");
    });

    test("現在のパスでないリンクにはaria-currentが設定されない", () => {
      mockUsePathname.mockReturnValue("/reports");
      render(<NavLinks isManager={false} />);

      const customersLink = screen.getByText("顧客マスタ").closest("a");
      expect(customersLink).not.toHaveAttribute("aria-current");
    });

    test("サブパスでもアクティブスタイルが適用される", () => {
      mockUsePathname.mockReturnValue("/customers/123");
      render(<NavLinks isManager={false} />);

      const customersLink = screen.getByText("顧客マスタ").closest("a");
      expect(customersLink).toHaveAttribute("aria-current", "page");
    });
  });
});
