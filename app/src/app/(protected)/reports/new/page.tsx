import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CreateReportForm } from "./_components/CreateReportForm";

export default async function NewReportPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  // 上長は日報を作成できない → ダッシュボードへ
  if (session.is_manager) {
    redirect("/");
  }

  // 顧客一覧を取得（ページングなしで全件）
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, company: true },
    orderBy: { company: "asc" },
  });

  // 本日の日付（YYYY-MM-DD）
  const today = new Date().toLocaleDateString("sv-SE"); // sv-SE locale produces YYYY-MM-DD

  return <CreateReportForm today={today} customers={customers} />;
}
