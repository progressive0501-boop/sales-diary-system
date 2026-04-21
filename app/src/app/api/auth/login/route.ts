import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth/jwt";
import { LoginRequestSchema } from "@/lib/schemas/auth";

// Cookie / JWT の有効期限 (秒)
const TOKEN_MAX_AGE_SEC = 60 * 60 * 24; // 24 時間

export async function POST(request: NextRequest) {
  // ── 1. リクエストボディのパース・バリデーション ────────────────────────────
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

  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.message },
      },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  // ── 2. ユーザー検索 ────────────────────────────────────────────���───────────
  const user = await prisma.salesperson.findUnique({ where: { email } });
  if (!user) {
    return Response.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが正しくありません",
        },
      },
      { status: 401 },
    );
  }

  // ── 3. パスワード検証 ──────────────────────────────────────────────────────
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return Response.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが正しくありません",
        },
      },
      { status: 401 },
    );
  }

  // ── 4. JWT 生成 ────────────────────────────────────────────────────────────
  const token = await signToken({
    sub: String(user.id),
    name: user.name,
    email: user.email,
    is_manager: user.isManager,
  });

  const expiresAt = new Date(Date.now() + TOKEN_MAX_AGE_SEC * 1000).toISOString();

  // ── 5. HttpOnly Cookie にトークンをセット ──────────────────────────────────
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE_SEC,
    path: "/",
  });

  // ── 6. レスポンス ──────────────────────────────────────────────────────────
  return Response.json({
    success: true,
    data: {
      token,
      expires_at: expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_manager: user.isManager,
      },
    },
  });
}
