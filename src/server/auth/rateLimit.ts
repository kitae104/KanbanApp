import "server-only";

import { query } from "@/server/db/pool";

// 최근 15분 동안 같은 이메일 또는 같은 IP에서 로그인 실패가 10번 쌓이면 막는다 (NFR-2).
export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 10;

export async function isLoginBlocked(email: string, ip: string, now = new Date()): Promise<boolean> {
  const { rows } = await query<{ by_email: string; by_ip: string }>(
    `SELECT count(*) FILTER (WHERE email = $1) AS by_email,
            count(*) FILTER (WHERE ip = $2)    AS by_ip
       FROM login_attempts
      WHERE NOT succeeded
        AND attempted_at > $3::timestamptz - make_interval(mins => $4)
        AND attempted_at <= $3::timestamptz
        AND (email = $1 OR ip = $2)`,
    [email, ip, now, LOGIN_WINDOW_MINUTES],
  );
  const { by_email, by_ip } = rows[0];
  return Number(by_email) >= LOGIN_MAX_FAILURES || Number(by_ip) >= LOGIN_MAX_FAILURES;
}

export async function recordLoginAttempt(
  email: string,
  ip: string,
  succeeded: boolean,
  now = new Date(),
): Promise<void> {
  await query(
    "INSERT INTO login_attempts (email, ip, succeeded, attempted_at) VALUES ($1, $2, $3, $4)",
    [email, ip, succeeded, now],
  );
}

/** 프록시 뒤에서는 x-forwarded-for의 첫 값이 클라이언트 IP다. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "local";
}
