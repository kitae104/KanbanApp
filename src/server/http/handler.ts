import "server-only";

import type { z } from "zod";
import { getSession } from "@/server/auth/dal";
import type { SessionUser } from "@/server/auth/session";
import { invalid, serverError, unauthorized } from "./respond";
import { assertSameOrigin } from "./sameOrigin";

/**
 * 보드 API 공통 처리 (plan §5.2).
 * 상태를 바꾸는 요청은 Origin을 확인하고(403), 세션이 없으면 401, 예외는 500으로 바꾼다.
 * handler는 세션에서 얻은 boardId만 쓴다. 요청 본문의 boardId·userId는 무시된다 (NFR-1).
 */
export async function withSession(
  request: Request,
  handler: (session: SessionUser) => Promise<Response>,
): Promise<Response> {
  if (request.method !== "GET") {
    const denied = assertSameOrigin(request);
    if (denied) return denied;
  }
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    return await handler(session);
  } catch (error) {
    return serverError(error);
  }
}

/** JSON 본문을 스키마로 검증한다. 실패하면 400 응답을 돌려준다. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: invalid() };
  }
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_");
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, response: invalid(fieldErrors) };
}
