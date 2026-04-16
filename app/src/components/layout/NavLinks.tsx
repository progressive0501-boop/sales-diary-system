"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
};

type NavLinksProps = {
  isManager: boolean;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { label: "日報一覧", href: "/reports" },
  { label: "顧客マスタ", href: "/customers" },
];

const MANAGER_ONLY_NAV_ITEMS: NavItem[] = [
  { label: "営業マスタ", href: "/salespersons" },
];

export function NavLinks({ isManager }: NavLinksProps) {
  const pathname = usePathname();
  const navItems = isManager
    ? [...BASE_NAV_ITEMS, ...MANAGER_ONLY_NAV_ITEMS]
    : BASE_NAV_ITEMS;

  return (
    <nav aria-label="グローバルナビゲーション">
      <ul className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
