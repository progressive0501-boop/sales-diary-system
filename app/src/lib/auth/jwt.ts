import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// JWT に含めるユーザー情報
export type JwtUserPayload = {
  sub: string; // salesperson id (文字列)
  name: string;
  email: string;
  is_manager: boolean;
};

// jose が返す payload は JWTPayload を extends する必要があるため交差型で定義
export type VerifiedPayload = JWTPayload & JwtUserPayload;

const TOKEN_EXPIRY = "24h";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * JWT を生成する
 */
export async function signToken(payload: JwtUserPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

/**
 * JWT を検証し、ペイロードを返す。
 * 検証失敗（署名不一致・期限切れ等）は例外をスローする。
 */
export async function verifyToken(token: string): Promise<VerifiedPayload> {
  const secret = getSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload as VerifiedPayload;
}
