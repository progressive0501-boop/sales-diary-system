import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { SalespersonListQuerySchema } from "@/lib/schemas/salespersons";

export async function GET(request: NextRequest) {
  // ── 1. 認証・権限確認 ──────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
      { status: 401 },
    );
  }
  if (!session.is_manager) {
    return Response.json(
      { success: false, error: { code: "FORBIDDEN", message: "上長ユーザーのみ取得できます" } },
      { status: 403 },
    );
  }

  // ── 2. クエリパラメータ検証 ──────────────────────────────────────────────
  const sp = request.nextUrl.searchParams;
  const parsed = SalespersonListQuerySchema.safeParse({
    q: sp.get("q") ?? undefined,
    page: sp.get("page") ?? undefined,
    per_page: sp.get("per_page") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { q, page, per_page } = parsed.data;

  // ── 3. 検索条件構築 ──────────────────────────────────────────────────────
  const where = q
    ? { name: { contains: q, mode: "insensitive" as const } }
    : {};

  // ── 4. 件数取得 & 一覧取得 ──────────────────────────────────────────────
  const [total, salespersons] = await Promise.all([
    prisma.salesperson.count({ where }),
    prisma.salesperson.findMany({
      where,
      include: { manager: { select: { name: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * per_page,
      take: per_page,
    }),
  ]);

  const items = salespersons.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    department: s.department ?? null,
    is_manager: s.isManager,
    manager_id: s.managerId ?? null,
    manager_name: s.manager?.name ?? null,
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
