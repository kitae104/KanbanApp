import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BoardProvider, MESSAGES, type BoardContextValue } from "@/components/board/BoardProvider";
import { useBoard } from "@/hooks/useBoard";
import type { BoardRepository, LoadResult, SaveResult } from "@/lib/storage/boardRepository";
import { STORAGE_KEY } from "@/lib/storage/localStorageBoardRepository";
import { T1, makeBoard } from "../board/helpers";

function fakeRepository(
  load: LoadResult = { ok: false, reason: "empty" },
  save: SaveResult = { ok: true },
) {
  return {
    load: vi.fn<BoardRepository["load"]>(() => load),
    save: vi.fn<BoardRepository["save"]>(() => save),
  };
}

/** Provider 값을 바깥으로 꺼내고, 렌더마다 hydration 여부를 기록한다. */
function renderProvider(repository: BoardRepository) {
  const ref: { current: BoardContextValue | null } = { current: null };
  const hydratedHistory: boolean[] = [];
  function Probe() {
    const value = useBoard();
    ref.current = value;
    hydratedHistory.push(value.isHydrated);
    return <p data-testid="todo">{value.board.columns.TODO.join(",")}</p>;
  }
  render(
    <BoardProvider repository={repository}>
      <Probe />
    </BoardProvider>,
  );
  return { ctx: () => ref.current!, hydratedHistory };
}

const addCard = (id: string) =>
  ({ type: "ADD_CARD", id, title: id, description: "", now: T1 }) as const;

describe("BoardProvider 초기 로딩 (T-013)", () => {
  it("서버 렌더에서는 hydration 전 상태다", () => {
    function Probe() {
      return <p>{useBoard().isHydrated ? "ready" : "skeleton"}</p>;
    }
    const html = renderToString(
      <BoardProvider repository={fakeRepository()}>
        <Probe />
      </BoardProvider>,
    );
    expect(html).toContain("skeleton");
  });

  it("브라우저에서는 저장된 보드를 불러와 보여준다", () => {
    const repo = fakeRepository({ ok: true, board: makeBoard({ TODO: ["a", "b"] }) });
    const { hydratedHistory } = renderProvider(repo);
    expect(hydratedHistory.at(-1)).toBe(true);
    expect(repo.load).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("todo")).toHaveTextContent("a,b");
  });

  it("저장 데이터가 손상됐으면 빈 보드로 시작하고 안내한다", () => {
    const { ctx } = renderProvider(fakeRepository({ ok: false, reason: "corrupt" }));
    expect(ctx().board.columns.TODO).toEqual([]);
    expect(ctx().toast?.message).toBe(MESSAGES.corrupt);
  });

  it("저장된 값이 없으면 안내 없이 빈 보드로 시작한다", () => {
    const { ctx } = renderProvider(fakeRepository());
    expect(ctx().toast).toBeNull();
  });

  it("Provider 밖에서 useBoard를 쓰면 오류를 던진다", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Orphan() {
      useBoard();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/BoardProvider/);
    vi.restoreAllMocks();
  });
});

describe("commit / preview (T-014)", () => {
  it("저장에 성공하면 상태를 반영한다", () => {
    const repo = fakeRepository();
    const { ctx } = renderProvider(repo);
    let ok = false;
    act(() => {
      ok = ctx().commit(addCard("a"));
    });
    expect(ok).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.save.mock.calls[0][0].columns.TODO).toEqual(["a"]);
    expect(screen.getByTestId("todo")).toHaveTextContent("a");
  });

  it("저장에 실패하면 마지막 저장 상태로 되돌리고 알린다 (FR-18)", () => {
    const repo = fakeRepository({ ok: true, board: makeBoard({ TODO: ["a"] }) });
    const { ctx } = renderProvider(repo);
    repo.save.mockReturnValue({ ok: false, error: "quota" });
    let ok = true;
    act(() => {
      ok = ctx().commit(addCard("b"));
    });
    expect(ok).toBe(false);
    expect(ctx().board.columns.TODO).toEqual(["a"]);
    expect(ctx().toast?.message).toBe(MESSAGES.saveFailed);
  });

  it("미리보기 중 실패하면 미리보기 이전(마지막 저장) 상태로 돌아간다", () => {
    const repo = fakeRepository({ ok: true, board: makeBoard({ TODO: ["a"] }) });
    const { ctx } = renderProvider(repo);
    repo.save.mockReturnValue({ ok: false, error: "unknown" });
    act(() => {
      ctx().preview({ type: "MOVE_CARD", id: "a", toStatus: "DONE", toIndex: 0, now: T1 });
    });
    expect(ctx().board.columns.DONE).toEqual(["a"]);
    act(() => {
      ctx().commit({ type: "MOVE_CARD", id: "a", toStatus: "IN_PROGRESS", toIndex: 0, now: T1 });
    });
    expect(ctx().board.columns).toEqual({ TODO: ["a"], IN_PROGRESS: [], DONE: [] });
  });

  it("preview는 저장하지 않는다", () => {
    const repo = fakeRepository();
    const { ctx } = renderProvider(repo);
    act(() => ctx().preview(addCard("a")));
    expect(repo.save).not.toHaveBeenCalled();
    expect(ctx().board.columns.TODO).toEqual(["a"]);
  });

  it("결과가 마지막 저장 상태와 같으면 저장하지 않는다", () => {
    const repo = fakeRepository({ ok: true, board: makeBoard({ TODO: ["a"] }) });
    const { ctx } = renderProvider(repo);
    act(() => {
      ctx().commit({ type: "MOVE_CARD", id: "a", toStatus: "TODO", toIndex: 0, now: T1 });
    });
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe("탭 간 동기화 (T-015)", () => {
  const fireStorage = () =>
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });

  it("다른 탭에서 저장하면 화면을 갱신한다", () => {
    const repo = fakeRepository();
    const { ctx } = renderProvider(repo);
    repo.load.mockReturnValue({ ok: true, board: makeBoard({ DONE: ["z"] }) });
    fireStorage();
    expect(ctx().board.columns.DONE).toEqual(["z"]);
  });

  it("드래그 중에는 무시한다", () => {
    const repo = fakeRepository();
    const { ctx } = renderProvider(repo);
    repo.load.mockReturnValue({ ok: true, board: makeBoard({ DONE: ["z"] }) });
    act(() => ctx().setDragging(true));
    fireStorage();
    expect(ctx().board.columns.DONE).toEqual([]);
  });
});
