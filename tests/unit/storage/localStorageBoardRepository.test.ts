import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  createLocalStorageBoardRepository,
} from "@/lib/storage/localStorageBoardRepository";
import { makeBoard } from "../board/helpers";

const repo = createLocalStorageBoardRepository();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("load / save", () => {
  it("저장한 보드를 그대로 불러온다", () => {
    const board = makeBoard({ TODO: ["a", "b"], DONE: ["c"] });
    expect(repo.save(board)).toEqual({ ok: true });
    expect(repo.load()).toEqual({ ok: true, board });
  });

  it("버전·저장 시각과 함께 저장한다", () => {
    repo.save(makeBoard({}));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    expect(stored.version).toBe(1);
    expect(typeof stored.savedAt).toBe("string");
  });

  it("저장된 값이 없으면 empty", () => {
    expect(repo.load()).toEqual({ ok: false, reason: "empty" });
  });

  it("불러올 때 status/order를 컬럼 기준으로 보정한다", () => {
    const board = makeBoard({ TODO: ["a"] });
    board.cards.a = { ...board.cards.a, status: "DONE", order: 5 };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, savedAt: "2026-01-01T00:00:00.000Z", board }),
    );
    const result = repo.load();
    expect(result.ok && result.board.cards.a).toMatchObject({ status: "TODO", order: 0 });
  });

  it("localStorage에 접근할 수 없으면 unavailable", () => {
    const blocked = createLocalStorageBoardRepository(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(blocked.load()).toEqual({ ok: false, reason: "unavailable" });
    expect(blocked.save(makeBoard({}))).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("손상된 데이터 (T-012)", () => {
  const backupKeys = () =>
    Object.keys(localStorage).filter((key) => key.startsWith(`${STORAGE_KEY}:corrupt-`));

  it.each([
    ["깨진 JSON", "{not json"],
    ["스키마 불일치", JSON.stringify({ version: 1, savedAt: "x", board: { cards: 1 } })],
    ["미래 버전", JSON.stringify({ version: 99, savedAt: "2026-01-01T00:00:00.000Z", board: {} })],
    ["버전 없음", JSON.stringify({ board: {} })],
  ])("%s는 corrupt로 처리하고 원본을 백업한다", (_, raw) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, raw);
    expect(repo.load()).toEqual({ ok: false, reason: "corrupt" });
    expect(backupKeys()).toHaveLength(1);
    expect(localStorage.getItem(backupKeys()[0])).toBe(raw);
    expect(console.warn).toHaveBeenCalled();
  });

  it("같은 손상 데이터를 여러 번 불러와도 백업은 하나다", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, "{broken");
    repo.load();
    repo.load();
    repo.load();
    expect(backupKeys()).toHaveLength(1);
  });
});

describe("저장 실패 (T-012)", () => {
  it("용량 초과는 quota", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(repo.save(makeBoard({}))).toEqual({ ok: false, error: "quota" });
  });

  it("Firefox의 용량 초과 이름도 quota로 본다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "NS_ERROR_DOM_QUOTA_REACHED");
    });
    expect(repo.save(makeBoard({}))).toEqual({ ok: false, error: "quota" });
  });

  it("접근 거부는 unavailable, 그 밖의 오류는 unknown", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setItem.mockImplementationOnce(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(repo.save(makeBoard({}))).toEqual({ ok: false, error: "unavailable" });
    setItem.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(repo.save(makeBoard({}))).toEqual({ ok: false, error: "unknown" });
  });
});
