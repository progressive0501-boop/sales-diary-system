import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ReportDetailClient } from "./_components/ReportDetailClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id: rawId } = await params;
  const reportId = Number(rawId);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    notFound();
  }

  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: {
      salesperson: { select: { name: true, managerId: true } },
      visitRecords: {
        include: { customer: { select: { name: true, company: true } } },
        orderBy: { visitOrder: "asc" },
      },
      comments: {
        include: { commenter: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!report) {
    notFound();
  }

  // アクセス制御: 本人 or 直属上長のみ閲覧可
  const isOwner = report.salespersonId === session.id;
  const isManager = session.is_manager;
  const isDirectManager =
    isManager && report.salesperson.managerId === session.id;

  if (!isOwner && !isDirectManager) {
    redirect("/");
  }

  // 顧客一覧（編集モード用）
  const customers = isOwner
    ? await prisma.customer.findMany({
        select: { id: true, name: true, company: true },
        orderBy: { company: "asc" },
      })
    : [];

  // レスポンス用データ整形
  const reportData = {
    id: report.id,
    salesperson_id: report.salespersonId,
    salesperson_name: report.salesperson.name,
    report_date: report.reportDate.toLocaleDateString("sv-SE"),
    problem: report.problem,
    plan: report.plan,
    visit_records: report.visitRecords.map((vr) => ({
      id: vr.id,
      customer_id: vr.customerId,
      customer_name: vr.customer.name,
      customer_company: vr.customer.company,
      visit_content: vr.visitContent,
      visit_order: vr.visitOrder,
    })),
    comments: {
      problem: report.comments
        .filter((c) => c.targetType === "PROBLEM")
        .map((c) => ({
          id: c.id,
          commenter_id: c.commenterId,
          commenter_name: c.commenter.name,
          content: c.content,
          created_at: c.createdAt.toISOString(),
        })),
      plan: report.comments
        .filter((c) => c.targetType === "PLAN")
        .map((c) => ({
          id: c.id,
          commenter_id: c.commenterId,
          commenter_name: c.commenter.name,
          content: c.content,
          created_at: c.createdAt.toISOString(),
        })),
    },
  };

  return (
    <ReportDetailClient
      report={reportData}
      isOwner={isOwner}
      isManager={isDirectManager}
      customers={customers}
    />
  );
}
