import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { UpdateCustomerRequestSchema } from "@/lib/schemas/customers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── 1. 認証 ────────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
      { status: 401 },
    );
  }

  // ── 2. ID 検証 ──────────────────────────────────────────────────────────
  const { id: rawId } = await params;
  const customerId = Number(rawId);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "顧客が見つかりません" } },
      { status: 404 },
    );
  }

  // ── 3. 顧客取得 ──────────────────────────────────────────────────────────
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { assignedSalesperson: { select: { name: true } } },
  });

  if (!customer) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "顧客が見つかりません" } },
      { status: 404 },
    );
  }

  return Response.json({
    success: true,
    data: {
      id: customer.id,
      name: customer.name,
      company: customer.company,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
      assigned_salesperson_id: customer.assignedSalespersonId,
      assigned_salesperson_name: customer.assignedSalesperson.name,
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
  const customerId = Number(rawId);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "顧客が見つかりません" } },
      { status: 404 },
    );
  }

  // ── 3. 顧客存在確認 ──────────────────────────────────────────────────────
  const existing = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!existing) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "顧客が見つかりません" } },
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

  const parsed = UpdateCustomerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { name, company, phone, address, assigned_salesperson_id } = parsed.data;

  // ── 5. 担当営業の存在確認 ──────────────────────────────────────────────────
  const salesperson = await prisma.salesperson.findUnique({
    where: { id: assigned_salesperson_id },
    select: { id: true },
  });
  if (!salesperson) {
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "担当営業が存在しません" } },
      { status: 400 },
    );
  }

  // ── 6. 顧客更新 ────────────────────────────────────────────────────────────
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name,
      company,
      phone: phone ?? null,
      address: address ?? null,
      assignedSalespersonId: assigned_salesperson_id,
    },
    select: { id: true, name: true, company: true },
  });

  return Response.json({ success: true, data: updated });
}
