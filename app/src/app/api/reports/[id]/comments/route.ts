import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CreateCommentRequestSchema } from "@/lib/schemas/comments";

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

  // ── 3. 日報存在確認 ──────────────────────────────────────────────────────
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: {
      salespersonId: true,
      salesperson: { select: { managerId: true } },
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

  // ── 4. アクセス制御（GET /reports/:id と同じ）────────────────────────────
  if (!session.is_manager) {
    if (report.salespersonId !== session.id) {
      return Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "この日報のコメントを取得する権限がありません",
          },
        },
        { status: 403 },
      );
    }
  } else {
    if (report.salesperson.managerId !== session.id) {
      return Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "この日報のコメントを取得する権限がありません",
          },
        },
        { status: 403 },
      );
    }
  }

  // ── 5. コメント取得（created_at 昇順）───────────────────────────────────
  const comments = await prisma.comment.findMany({
    where: { reportId },
    include: {
      commenter: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // ── 6. problem / plan に分類 ─────────────────────────────────────────────
  const format = (targetType: "PROBLEM" | "PLAN") =>
    comments
      .filter((c) => c.targetType === targetType)
      .map((c) => ({
        id: c.id,
        commenter_id: c.commenterId,
        commenter_name: c.commenter.name,
        content: c.content,
        created_at: c.createdAt.toISOString(),
      }));

  return Response.json({
    success: true,
    data: {
      problem: format("PROBLEM"),
      plan: format("PLAN"),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports/:id/comments — コメント投稿（上長ユーザーのみ）
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
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

  // ── 2. 営業ユーザーは投稿不可 ────────────────────────────────────────────
  if (!session.is_manager) {
    return Response.json(
      {
        success: false,
        error: { code: "FORBIDDEN", message: "上長ユーザーのみコメントを投稿できます" },
      },
      { status: 403 },
    );
  }

  // ── 3. パスパラメータ検証 ────────────────────────────────────────────────
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

  // ── 4. 日報存在確認 ──────────────────────────────────────────────────────
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: {
      salesperson: { select: { managerId: true } },
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

  // ── 5. 配下の日報かを確認 ────────────────────────────────────────────────
  if (report.salesperson.managerId !== session.id) {
    return Response.json(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "この日報にコメントする権限がありません",
        },
      },
      { status: 403 },
    );
  }

  // ── 6. リクエストボディ検証 ──────────────────────────────────────────────
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

  const parsed = CreateCommentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.message },
      },
      { status: 400 },
    );
  }

  const { target_type, content } = parsed.data;
  const targetType = target_type.toUpperCase() as "PROBLEM" | "PLAN";

  // ── 7. コメント作成 ──────────────────────────────────────────────────────
  const comment = await prisma.comment.create({
    data: {
      reportId,
      targetType,
      commenterId: session.id,
      content,
    },
    include: {
      commenter: { select: { name: true } },
    },
  });

  return Response.json(
    {
      success: true,
      data: {
        id: comment.id,
        report_id: reportId,
        target_type,
        commenter_id: comment.commenterId,
        commenter_name: comment.commenter.name,
        content: comment.content,
        created_at: comment.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
