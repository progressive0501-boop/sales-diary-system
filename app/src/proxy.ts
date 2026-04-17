import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import {
  SESSION_HEADER_USER_EMAIL,
  SESSION_HEADER_USER_ID,
  SESSION_HEADER_USER_IS_MANAGER,
  SESSION_HEADER_USER_NAME,
} from "@/lib/auth/session";

// ─────────────────────────────────────────────────────────────────────────────
// 保護対象外ルート（認証不要）
// ─────────────────────────────────────────────────────────────────────────────
const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// トークン抽出: Authorization ヘッダー → Cookie の順に探す
// ─────────────────────────────────────────────────────────────────────────────
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return request.cookies.get("token")?.value ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Next.js 16 Proxy（旧: middleware）
// ─────────────────────────────────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 保護対象外ルートはそのまま通過
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = extractToken(request);

  // トークンなし
  if (!token) {
    return unauthorizedResponse(request);
  }

  // トークン検証
  try {
    const payload = await verifyToken(token);

    // 検証成功: ユーザー情報をリクエストヘッダーに付与して通過
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(SESSION_HEADER_USER_ID, payload.sub);
    // 日本語を含む場合にByteSting制約を回避するためencodeURIComponentでエンコード
    requestHeaders.set(
      SESSION_HEADER_USER_NAME,
      encodeURIComponent(payload.name),
    );
    requestHeaders.set(SESSION_HEADER_USER_EMAIL, payload.email);
    requestHeaders.set(
      SESSION_HEADER_USER_IS_MANAGER,
      String(payload.is_manager),
    );

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    return unauthorizedResponse(request);
  }
}

/**
 * API ルート → 401 JSON、画面ルート → /login リダイレクト
 */
function unauthorizedResponse(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return Response.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "認証が必要です" },
      },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// Matcher: 静的ファイル・Next.js 内部ルートを除外
// ─────────────────────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
