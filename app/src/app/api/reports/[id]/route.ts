import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── 1. セッション確認 ────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return Response.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "認証が必要です" },
      },
      { status: 401 },
    );
  }

  // ── 2. パスパラメータ検証 ────────────────────────────────────────────────
  const { id: rawId } = await params;
  const reportId = Number(rawId);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return Response.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "日報が見つかりません" },
      },
      { status: 404 },
    );
  }

  // ── 3. 日報取得 ──────────────────────────────────────────────────────────
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: {
      salesperson: { select: { name: true, managerId: true } },
      visitRecords: {
        include: {
          customer: { select: { name: true, company: true } },
        },
        orderBy: { visitOrder: "asc" },
      },
      comments: {
        include: {
          commenter: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!report) {
    return Response.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "日報が見つかりません" },
      },
      { status: 404 },
    );
  }

  // ── 4. アクセス制御 ──────────────────────────────────────────────────────
  if (!session.is_manager) {
    // 営業: 自分の日報のみ
    if (report.salespersonId !== session.id) {
      return Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "この日報を閲覧する権限がありません",
          },
        },
        { status: 403 },
      );
    }
  } else {
    // 上長: 自分の配下の日報のみ
    if (report.salesperson.managerId !== session.id) {
      return Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "この日報を閲覧する権限がありません",
          },
        },
        { status: 403 },
      );
    }
  }

  // ── 5. レスポンス整形 ────────────────────────────────────────────────────
  const visitRecords = report.visitRecords.map((vr) => ({
    id: vr.id,
    customer_id: vr.customerId,
    customer_name: vr.customer.name,
    customer_company: vr.customer.company,
    visit_content: vr.visitContent,
    visit_order: vr.visitOrder,
  }));

  const comments = {
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
  };

  return Response.json({
    success: true,
    data: {
      id: report.id,
      salesperson_id: report.salespersonId,
      salesperson_name: report.salesperson.name,
      report_date: report.reportDate.toISOString().split("T")[0],
      problem: report.problem,
      plan: report.plan,
      visit_records: visitRecords,
      comments,
      created_at: report.createdAt.toISOString(),
      updated_at: report.updatedAt.toISOString(),
    },
  });
}
