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

  // ── 3. 日報存在確認 ──────────────────────────────────────────────────────
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: {
      salespersonId: true,
      salesperson: { select: { managerId: true } },
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

  // ── 4. アクセス制御（GET /reports/:id と同じ）────────────────────────────
  if (!session.is_manager) {
    // 営業: 自分の日報のみ
    if (report.salespersonId !== session.id) {
      return Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "この日報の訪問記録を取得する権限がありません",
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
            message: "この日報の訪問記録を取得する権限がありません",
          },
        },
        { status: 403 },
      );
    }
  }

  // ── 5. 訪問記録取得（visit_order 昇順）──────────────────────────────────
  const visitRecords = await prisma.visitRecord.findMany({
    where: { reportId },
    include: {
      customer: { select: { name: true, company: true } },
    },
    orderBy: { visitOrder: "asc" },
  });

  // ── 6. レスポンス整形 ────────────────────────────────────────────────────
  const items = visitRecords.map((vr) => ({
    id: vr.id,
    customer_id: vr.customerId,
    customer_name: vr.customer.name,
    customer_company: vr.customer.company,
    visit_content: vr.visitContent,
    visit_order: vr.visitOrder,
  }));

  return Response.json({
    success: true,
    data: { items },
  });
}
