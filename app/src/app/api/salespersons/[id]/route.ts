import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { UpdateSalespersonRequestSchema } from "@/lib/schemas/salespersons";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  // ── 2. ID 検証 ──────────────────────────────────────────────────────────
  const { id: rawId } = await params;
  const salespersonId = Number(rawId);
  if (!Number.isInteger(salespersonId) || salespersonId <= 0) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "営業が見つかりません" } },
      { status: 404 },
    );
  }

  // ── 3. 営業取得 ──────────────────────────────────────────────────────────
  const salesperson = await prisma.salesperson.findUnique({
    where: { id: salespersonId },
    include: { manager: { select: { name: true } } },
  });

  if (!salesperson) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "営業が見つかりません" } },
      { status: 404 },
    );
  }

  return Response.json({
    success: true,
    data: {
      id: salesperson.id,
      name: salesperson.name,
      email: salesperson.email,
      department: salesperson.department ?? null,
      is_manager: salesperson.isManager,
      manager_id: salesperson.managerId ?? null,
      manager_name: salesperson.manager?.name ?? null,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      { success: false, error: { code: "FORBIDDEN", message: "上長ユーザーのみ更新できます" } },
      { status: 403 },
    );
  }

  // ── 2. ID 検証 ──────────────────────────────────────────────────────────
  const { id: rawId } = await params;
  const salespersonId = Number(rawId);
  if (!Number.isInteger(salespersonId) || salespersonId <= 0) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "営業が見つかりません" } },
      { status: 404 },
    );
  }

  // ── 3. 営業存在確認 ──────────────────────────────────────────────────────
  const existing = await prisma.salesperson.findUnique({ where: { id: salespersonId } });
  if (!existing) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "営業が見つかりません" } },
      { status: 404 },
    );
  }

  // ── 4. リクエストボディ検証 ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "不正なJSONです" } },
      { status: 400 },
    );
  }

  const parsed = UpdateSalespersonRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { name, email, department, manager_id, is_manager } = parsed.data;

  // ── 5. manager_id の存在・上長確認 ────────────────────────────────────────
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

  // ── 6. 更新 ────────────────────────────────────────────────────────────────
  try {
    const updated = await prisma.salesperson.update({
      where: { id: salespersonId },
      data: {
        name,
        email,
        department: department ?? null,
        isManager: is_manager,
        managerId: manager_id,
      },
      select: { id: true, name: true, email: true },
    });

    return Response.json({ success: true, data: updated });
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
