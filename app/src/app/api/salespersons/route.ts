import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  SalespersonListQuerySchema,
  CreateSalespersonRequestSchema,
} from "@/lib/schemas/salespersons";

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

export async function POST(request: NextRequest) {
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
      { success: false, error: { code: "FORBIDDEN", message: "上長ユーザーのみ登録できます" } },
      { status: 403 },
    );
  }

  // ── 2. リクエストボディ検証 ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "不正なJSONです" } },
      { status: 400 },
    );
  }

  const parsed = CreateSalespersonRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { name, email, password, department, manager_id, is_manager } = parsed.data;

  // ── 3. manager_id の存在・上長確認 ────────────────────────────────────────
  const manager = await prisma.salesperson.findUnique({
    where: { id: manager_id },
    select: { isManager: true },
  });
  if (!manager || !manager.isManager) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "manager_id には上長ユーザーのIDを指定してください" } },
      { status: 400 },
    );
  }

  // ── 4. パスワードハッシュ化・登録 ─────────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const salesperson = await prisma.salesperson.create({
      data: {
        name,
        email,
        passwordHash,
        department: department ?? null,
        isManager: is_manager,
        managerId: manager_id,
      },
      select: { id: true, name: true, email: true },
    });

    return Response.json({ success: true, data: salesperson }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return Response.json(
        { success: false, error: { code: "CONFLICT", message: "このメールアドレスは既に使用されています" } },
        { status: 409 },
      );
    }
    throw err;
  }
}
