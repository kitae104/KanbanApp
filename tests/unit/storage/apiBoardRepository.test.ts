import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBoardRepository, toRepoError } from "@/lib/storage/apiBoardRepository";

const respond = (status: number, body?: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );

afterEach(() => vi.restoreAllMocks());

describe("apiBoardRepository", () => {
  it.each([
    [400, "invalid"],
    [401, "unauthorized"],
    [404, "not_found"],
    [409, "conflict"],
    [500, "server"],
    [503, "server"],
  ])("HTTP %i는 %s 오류다", async (status, error) => {
    respond(status, { error: "x" });
    expect(await apiBoardRepository.deleteCard("a")).toEqual({ ok: false, error });
    expect(toRepoError(status)).toBe(error);
  });

  it("네트워크 오류는 network다", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await apiBoardRepository.moveCard("a", "DONE", 0)).toEqual({
      ok: false,
      error: "network",
    });
  });

  it("요청 경로, 메서드, 본문을 API 설계대로 보낸다", async () => {
    const fetchSpy = respond(200, { cards: {}, columns: {} });
    await apiBoardRepository.moveCard("card 1", "DONE", 2);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/board/cards/card%201/move");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(JSON.parse(String(init?.body))).toEqual({ toStatus: "DONE", toIndex: 2 });
  });

  it("204는 null 값으로 성공이다", async () => {
    respond(204);
    expect(await apiBoardRepository.deleteCard("a")).toEqual({ ok: true, value: null });
  });

  it("성공 응답의 JSON을 돌려준다", async () => {
    respond(201, { id: "a", title: "t" });
    expect(await apiBoardRepository.addCard({ id: "a", title: "t", description: "" })).toEqual({
      ok: true,
      value: { id: "a", title: "t" },
    });
  });
});
