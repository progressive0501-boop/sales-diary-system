import { cookies } from "next/headers";

// この Route Handler は proxy.ts で認証済みのリクエストのみ到達する。
// （トークンなし・無効トークンは proxy が 401 を返す）
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("token");

  return Response.json({ success: true, data: null });
}
