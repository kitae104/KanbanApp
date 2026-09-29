import { NextResponse, type NextRequest } from "next/server";

// 세션 쿠키 이름. src/server/auth/session.ts의 SESSION_COOKIE와 같아야 한다.
// Proxy는 모든 요청에서 돌기 때문에 서버 전용 모듈(DB)을 import하지 않는다.
const SESSION_COOKIE = "kanban_session";

const AUTH_PAGES = new Set(["/login", "/signup"]);

/**
 * 낙관적 리다이렉트 (plan §3 규칙 1). 쿠키가 있는지만 보고 DB는 조회하지 않는다.
 * 진짜 세션 확인은 페이지와 API의 requireSession/getSession이 한다.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname === "/" && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (AUTH_PAGES.has(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup"],
};
