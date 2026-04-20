import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
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
