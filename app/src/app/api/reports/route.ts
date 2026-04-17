import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ReportListQuerySchema } from "@/lib/schemas/reports";

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
