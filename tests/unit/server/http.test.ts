// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { invalid, notFound, serverError, unauthorized } from "@/server/http/respond";
import { assertSameOrigin } from "@/server/http/sameOrigin";

const request = (headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/board/cards", { method: "POST", headers });

describe("assertSameOrigin", () => {
  it("Origin의 host가 Host와 같으면 통과한다", () => {
    expect(assertSameOrigin(request({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBeNull();
  });

  it("프록시 뒤에서는 X-Forwarded-Host와 비교한다", () => {
    const req = request({
      origin: "https://kanban.example",
      host: "internal:3000",
      "x-forwarded-host": "kanban.example",
    });
    expect(assertSameOrigin(req)).toBeNull();
  });

  it.each([
    ["다른 Origin", { origin: "https://evil.example", host: "localhost:3000" }],
    ["Origin 없음", { host: "localhost:3000" }],
    ["잘못된 Origin", { origin: "null", host: "localhost:3000" }],
  ])("%s이면 403이다", async (_, headers) => {
    const response = assertSameOrigin(request(headers));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: "forbidden" });
  });
});

describe("respond", () => {
  afterEach(() => vi.restoreAllMocks());

  it("상태 코드와 오류 코드를 돌려주고 캐시를 막는다", async () => {
    const response = unauthorized();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect((await notFound().json()).error).toBe("not_found");
    expect(await invalid({ title: "제목을 입력하세요." }).json()).toEqual({
      error: "invalid",
      fieldErrors: { title: "제목을 입력하세요." },
    });
  });

  it("serverError 응답 본문에는 오류 메시지가 없다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = serverError(new Error('relation "cards" does not exist at SELECT ...'));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe('{"error":"server"}');
  });
});
