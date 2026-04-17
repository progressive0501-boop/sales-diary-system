import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { UpdateReportRequestSchema } from "@/lib/schemas/reports";

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

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/reports/:id — 日報更新（作成者本人のみ）
// ─────────────────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
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
  const existing = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: { salespersonId: true },
  });

  if (!existing) {
    return Response.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "日報が見つかりません" },
      },
      { status: 404 },
    );
  }

  // ── 4. 権限確認（作成者本人のみ）────────────────────────────────────────
  if (session.is_manager || existing.salespersonId !== session.id) {
    return Response.json(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "この日報を更新する権限がありません",
        },
      },
      { status: 403 },
    );
  }

  // ── 5. リクエストボディ検証 ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "リクエストボディが不正です" },
      },
      { status: 400 },
    );
  }

  const parsed = UpdateReportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.message },
      },
      { status: 400 },
    );
  }

  const { report_date, problem, plan, visit_records } = parsed.data;

  // ── 6. customer_id の存在確認 ────────────────────────────────────────────
  const customerIds = [...new Set(visit_records.map((vr) => vr.customer_id))];
  const existingCount = await prisma.customer.count({
    where: { id: { in: customerIds } },
  });
  if (existingCount !== customerIds.length) {
    return Response.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "指定された顧客IDが存在しません",
        },
      },
      { status: 400 },
    );
  }

  // ── 7. トランザクションで日報・訪問記録を差し替え更新 ────────────────────
  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 既存の訪問記録を全削除
      await tx.visitRecord.deleteMany({ where: { reportId } });

      // 日報を更新
      const report = await tx.dailyReport.update({
        where: { id: reportId },
        data: {
          reportDate: new Date(report_date),
          problem: problem ?? null,
          plan: plan ?? null,
        },
      });

      // 訪問記録を新規挿入
      await tx.visitRecord.createMany({
        data: visit_records.map((vr) => ({
          reportId,
          customerId: vr.customer_id,
          visitContent: vr.visit_content,
          visitOrder: vr.visit_order,
        })),
      });

      return report;
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        report_date: updated.reportDate.toISOString().split("T")[0],
        updated_at: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    // 同日の日報が既に存在 (salespersonId, reportDate) unique 制約違反
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: "同日の日報が既に存在します",
          },
        },
        { status: 409 },
      );
    }
    throw err;
  }
}
