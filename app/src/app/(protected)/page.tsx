import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ReportListClient } from "./_components/ReportListClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // ── 初期データを DB から直接取得（サーバーコンポーネント）──────────────────
  let salespersonIds: number[];
  if (!session.is_manager) {
    salespersonIds = [session.id];
  } else {
    const subordinates = await prisma.salesperson.findMany({
      where: { managerId: session.id },
      select: { id: true },
    });
    salespersonIds = subordinates.map((s) => s.id);
  }

  const where = { salespersonId: { in: salespersonIds } };
  const perPage = 20;

  const [total, reports] = await Promise.all([
    prisma.dailyReport.count({ where }),
    prisma.dailyReport.findMany({
      where,
      include: {
        salesperson: { select: { name: true } },
        _count: { select: { visitRecords: true, comments: true } },
      },
      orderBy: { reportDate: "desc" },
      take: perPage,
    }),
  ]);

  const initialItems = reports.map((r) => ({
    id: r.id,
    salesperson_id: r.salespersonId,
    salesperson_name: r.salesperson.name,
    report_date: r.reportDate.toISOString().split("T")[0],
    visit_count: r._count.visitRecords,
    has_comment: r._count.comments > 0,
  }));

  const initialPagination = {
    total,
    total_pages: Math.ceil(total / perPage) || 1,
    current_page: 1,
    per_page: perPage,
  };

  // 上長の場合：配下営業一覧を salespersonOptions として渡す
  const salespersonOptions = session.is_manager
    ? Array.from(
        new Map(
          initialItems.map((item) => [
            item.salesperson_id,
            { id: item.salesperson_id, name: item.salesperson_name },
          ]),
        ).values(),
      )
    : [];

  return (
    <ReportListClient
      isManager={session.is_manager}
      initialItems={initialItems}
      initialPagination={initialPagination}
      initialSalespersonOptions={salespersonOptions}
    />
  );
}
