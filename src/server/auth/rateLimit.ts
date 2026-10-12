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

// 같은 IP에서 1시간 동안 5번까지 가입을 시도할 수 있다. 가입은 argon2 해시를 계산하므로
// 성공·실패와 상관없이 해시까지 가는 시도를 모두 센다.
export const SIGNUP_WINDOW_MINUTES = 60;
export const SIGNUP_MAX_ATTEMPTS = 5;

/** E2E는 같은 IP에서 계정을 많이 만들므로, 테스트 서버만 SIGNUP_MAX_ATTEMPTS로 한도를 올린다. */
function signupLimit(): number {
  const configured = Number(process.env.SIGNUP_MAX_ATTEMPTS);
  return Number.isInteger(configured) && configured > 0 ? configured : SIGNUP_MAX_ATTEMPTS;
}

export async function isSignupBlocked(ip: string, now = new Date()): Promise<boolean> {
  const { rows } = await query<{ attempts: string }>(
    `SELECT count(*) AS attempts
       FROM signup_attempts
      WHERE ip = $1
        AND attempted_at > $2::timestamptz - make_interval(mins => $3)
        AND attempted_at <= $2::timestamptz`,
    [ip, now, SIGNUP_WINDOW_MINUTES],
  );
  return Number(rows[0].attempts) >= signupLimit();
}

export async function recordSignupAttempt(ip: string, now = new Date()): Promise<void> {
  await query("INSERT INTO signup_attempts (ip, attempted_at) VALUES ($1, $2)", [ip, now]);
}

/** 프록시 뒤에서는 x-forwarded-for의 첫 값이 클라이언트 IP다. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "local";
}
