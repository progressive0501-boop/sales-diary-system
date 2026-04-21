import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  ReportListQuerySchema,
  CreateReportRequestSchema,
} from "@/lib/schemas/reports";

export async function GET(request: NextRequest) {
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

  // ── 2. クエリパラメータ検証 ──────────────────────────────────────────────
  const sp = request.nextUrl.searchParams;
  const parsed = ReportListQuerySchema.safeParse({
    salesperson_id: sp.get("salesperson_id") ?? undefined,
    year_month: sp.get("year_month") ?? undefined,
    page: sp.get("page") ?? undefined,
    per_page: sp.get("per_page") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.message },
      },
      { status: 400 },
    );
  }

  const { salesperson_id, year_month, page, per_page } = parsed.data;

  // ── 3. 取得対象の salesperson_id 一覧を決定 ──────────────────────────────
  let salespersonIds: number[];

  if (!session.is_manager) {
    // 営業: 他人の ID 指定は禁止
    if (salesperson_id !== undefined && salesperson_id !== session.id) {
      return Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "他の営業担当者の日報は取得できません",
          },
        },
        { status: 403 },
      );
    }
    salespersonIds = [session.id];
  } else {
    // 上長: 配下の営業一覧を取得
    const subordinates = await prisma.salesperson.findMany({
      where: { managerId: session.id },
      select: { id: true },
    });
    const subordinateIds = subordinates.map((s) => s.id);

    if (salesperson_id !== undefined) {
      // 指定があれば配下に限定してフィルター（配下外なら空リスト）
      salespersonIds = subordinateIds.includes(salesperson_id)
        ? [salesperson_id]
        : [];
    } else {
      salespersonIds = subordinateIds;
    }
  }

  // ── 4. 年月フィルター ────────────────────────────────────────────────────
  let dateFilter: { gte: Date; lt: Date } | undefined;
  if (year_month) {
    const [y, m] = year_month.split("-").map(Number);
    dateFilter = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1),
    };
  }

  // ── 5. DB クエリ ─────────────────────────────────────────────────────────
  const where = {
    salespersonId: { in: salespersonIds },
    ...(dateFilter && { reportDate: dateFilter }),
  };

  const [total, reports] = await Promise.all([
    prisma.dailyReport.count({ where }),
    prisma.dailyReport.findMany({
      where,
      include: {
        salesperson: { select: { name: true } },
        _count: { select: { visitRecords: true, comments: true } },
      },
      orderBy: { reportDate: "desc" },
      skip: (page - 1) * per_page,
      take: per_page,
    }),
  ]);

  // ── 6. レスポンス整形 ────────────────────────────────────────────────────
  const items = reports.map((r) => ({
    id: r.id,
    salesperson_id: r.salespersonId,
    salesperson_name: r.salesperson.name,
    report_date: r.reportDate.toISOString().split("T")[0],
    visit_count: r._count.visitRecords,
    has_comment: r._count.comments > 0,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }));

  return Response.json({
    success: true,
    data: {
      items,
      pagination: {
        total,
        total_pages: Math.ceil(total / per_page),
        current_page: page,
        per_page,
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports — 日報作成（営業ユーザーのみ）
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
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

  // ── 2. 上長は作成不可 ────────────────────────────────────────────────────
  if (session.is_manager) {
    return Response.json(
      {
        success: false,
        error: { code: "FORBIDDEN", message: "上長ユーザーは日報を作成できません" },
      },
      { status: 403 },
    );
  }

  // ── 3. リクエストボディ検証 ──────────────────────────────────────────────
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

  const parsed = CreateReportRequestSchema.safeParse(body);
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

  // ── 4. customer_id の存在確認 ────────────────────────────────────────────
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

  // ── 5. トランザクションで日報・訪問記録を保存 ────────────────────────────
  try {
    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.dailyReport.create({
        data: {
          salespersonId: session.id,
          reportDate: new Date(report_date),
          problem: problem ?? null,
          plan: plan ?? null,
        },
      });

      await tx.visitRecord.createMany({
        data: visit_records.map((vr) => ({
          reportId: created.id,
          customerId: vr.customer_id,
          visitContent: vr.visit_content,
          visitOrder: vr.visit_order,
        })),
      });

      return created;
    });

    return Response.json(
      {
        success: true,
        data: {
          id: report.id,
          report_date: report.reportDate.toISOString().split("T")[0],
        },
      },
      { status: 201 },
    );
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
