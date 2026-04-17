import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import LoginForm from "./_components/LoginForm";

// ログイン済みユーザーはダッシュボードへリダイレクト
export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    try {
      await verifyToken(token);
      redirect("/");
    } catch {
      // トークン無効 → ログイン画面を表示
    }
  }

  return <LoginForm />;
}
