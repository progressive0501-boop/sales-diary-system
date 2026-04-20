import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CustomerListQuerySchema } from "@/lib/schemas/customers";

export async function GET(request: NextRequest) {
  // ── 1. 認証 ────────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
      { status: 401 },
    );
  }

  // ── 2. クエリパラメータ検証 ──────────────────────────────────────────────
  const sp = request.nextUrl.searchParams;
  const parsed = CustomerListQuerySchema.safeParse({
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
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { company: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  // ── 4. 件数取得 & 一覧取得 ──────────────────────────────────────────────
  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: { assignedSalesperson: { select: { name: true } } },
      orderBy: { company: "asc" },
      skip: (page - 1) * per_page,
      take: per_page,
    }),
  ]);

  const items = customers.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    phone: c.phone ?? null,
    address: c.address ?? null,
    assigned_salesperson_id: c.assignedSalespersonId,
    assigned_salesperson_name: c.assignedSalesperson.name,
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
