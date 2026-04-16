import { getSession } from "@/lib/auth/session";
import { NavLinks } from "./NavLinks";
import { LogoutButton } from "./LogoutButton";

export async function Header() {
  const user = await getSession();

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <span className="text-base font-bold tracking-tight">
            営業日報システム
          </span>
          {user && <NavLinks isManager={user.is_manager} />}
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <LogoutButton />
          </div>
        )}
      </div>
    </header>
  );
}
