import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
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
