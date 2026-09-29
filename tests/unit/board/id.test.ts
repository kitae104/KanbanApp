import { afterEach, describe, expect, it, vi } from "vitest";
import { newCardId } from "@/lib/board/id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newCardId", () => {
  it("UUID v4 형식의 서로 다른 id를 만든다", () => {
    const ids = new Set(Array.from({ length: 50 }, newCardId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  it("randomUUID가 없어도(비보안 컨텍스트) 같은 형식을 만든다", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect(newCardId()).toMatch(UUID_V4);
  });
});
