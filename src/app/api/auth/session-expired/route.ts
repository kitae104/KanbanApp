import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/session";

/**
 * 쿠키는 있지만 세션이 만료·위조된 경우 쿠키를 지우고 로그인 화면으로 보낸다.
 * Server Component 렌더 중에는 쿠키를 바꿀 수 없어서 이 경로를 거친다 (T-019).
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
