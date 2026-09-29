import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query } from "@/server/db/pool";

export const SESSION_COOKIE = "kanban_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionUser {
  userId: string;
  email: string;
  boardId: string;
}

/** DB에는 토큰 원문 대신 sha256 hex만 저장한다 (NFR-5). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isSecureCookie(): boolean {
  const flag = process.env.SESSION_COOKIE_SECURE;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** 새 세션을 저장하고 토큰 원문을 돌려준다. 같은 유저의 만료된 세션은 이때 정리한다. */
export async function insertSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await query("DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()", [userId]);
  await query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    userId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await query<{ user_id: string; email: string; board_id: string }>(
    `SELECT u.id AS user_id, u.email, b.id AS board_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN boards b ON b.user_id = u.id
      WHERE s.id = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  const row = rows[0];
  return row ? { userId: row.user_id, email: row.email, boardId: row.board_id } : null;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (token) await query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);
}

// 아래 쿠키 함수는 Server Action이나 Route Handler에서만 부를 수 있다(Server Component 렌더 중에는 불가).

/** 로그인할 때마다 새 토큰을 발급해 세션 고정 공격을 막는다 (NFR-8). */
export async function createSession(userId: string): Promise<void> {
  const { token } = await insertSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
