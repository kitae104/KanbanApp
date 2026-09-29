import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUser, readSessionToken, type SessionUser } from "./session";

/** 세션이 만료된 쿠키를 지우고 /login으로 보내는 Route Handler. */
export const SESSION_EXPIRED_PATH = "/api/auth/session-expired";

/**
 * 요청 하나 안에서 세션을 한 번만 확인한다 (plan §3 규칙 2).
 * 모든 Server Component, Server Action, Route Handler가 이 함수를 거친다.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  return getSessionUser(await readSessionToken());
});

/**
 * 페이지용. 세션이 없으면 로그인 화면으로 보낸다.
 * 쿠키는 있는데 세션이 만료됐으면 쿠키를 지우는 경로를 거친다.
 * 그러지 않으면 Proxy가 /login을 다시 /로 보내 리다이렉트가 반복된다.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (session) return session;
  redirect((await readSessionToken()) ? SESSION_EXPIRED_PATH : "/login");
}
