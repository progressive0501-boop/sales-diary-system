import { headers } from "next/headers";

// プロキシが設定するリクエストヘッダーのキー
export const SESSION_HEADER_USER_ID = "x-user-id";
export const SESSION_HEADER_USER_NAME = "x-user-name";
export const SESSION_HEADER_USER_EMAIL = "x-user-email";
export const SESSION_HEADER_USER_IS_MANAGER = "x-user-is-manager";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  is_manager: boolean;
};

/**
 * Route Handler / Server Component 内でログインユーザーを取得する。
 *
 * proxy.ts が JWT 検証後に設定した x-user-* ヘッダーを読み取る。
 * プロキシを経由しないリクエスト（テスト等）では null を返す。
 */
export async function getSession(): Promise<SessionUser | null> {
  const headerStore = await headers();
  const userId = headerStore.get(SESSION_HEADER_USER_ID);
  const name = headerStore.get(SESSION_HEADER_USER_NAME);
  const email = headerStore.get(SESSION_HEADER_USER_EMAIL);
  const isManagerStr = headerStore.get(SESSION_HEADER_USER_IS_MANAGER);

  if (!userId || !name || !email || isManagerStr === null) {
    return null;
  }

  return {
    id: Number(userId),
    // proxy.ts で encodeURIComponent されているのでデコード
    name: decodeURIComponent(name),
    email,
    is_manager: isManagerStr === "true",
  };
}
