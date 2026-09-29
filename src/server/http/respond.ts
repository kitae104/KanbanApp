import "server-only";

// 보드 API의 응답 형식을 한곳에서 정한다 (plan §5.2).
// 오류 응답에는 SQL, 스택, 스키마 정보를 넣지 않는다 (NFR-6).

export type ApiError = "unauthorized" | "forbidden" | "not_found" | "invalid" | "conflict" | "server";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: NO_STORE });
}

const error = (status: number, code: ApiError, extra?: object) =>
  json(status, { error: code, ...extra });

export const unauthorized = () => error(401, "unauthorized");
export const forbidden = () => error(403, "forbidden");
export const notFound = () => error(404, "not_found");
export const conflict = () => error(409, "conflict");
export const invalid = (fieldErrors?: Record<string, string>) =>
  error(400, "invalid", fieldErrors ? { fieldErrors } : undefined);

/** 자세한 내용은 서버 로그에만 남긴다. */
export function serverError(cause: unknown): Response {
  console.error("[kanban] API 오류", cause);
  return error(500, "server");
}
