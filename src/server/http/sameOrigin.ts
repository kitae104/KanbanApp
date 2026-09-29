import "server-only";

import { forbidden } from "./respond";

/**
 * 상태를 바꾸는 요청의 Origin이 이 서버와 같은지 확인한다 (NFR-4).
 * Server Action이 내부에서 하는 Origin/Host 비교를 Route Handler에도 적용한다.
 * 같으면 null, 다르거나 Origin이 없으면 403 응답을 돌려준다.
 */
export function assertSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return forbidden();
  try {
    return new URL(origin).host === host ? null : forbidden();
  } catch {
    return forbidden();
  }
}
