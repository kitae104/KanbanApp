import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardProvider, MESSAGES, type BoardContextValue } from "@/components/board/BoardProvider";
import { useBoard } from "@/hooks/useBoard";
import { createEmptyBoard } from "@/lib/board/operations";
import type { BoardState } from "@/lib/board/types";
import { createMemoryBoardRepository } from "@/lib/storage/memoryBoardRepository";
import { T1, makeBoard } from "../board/helpers";

/** Provider 값을 바깥으로 꺼낸다. */
function renderProvider(initial: BoardState = createEmptyBoard()) {
  const repo = createMemoryBoardRepository(initial);
  const onUnauthorized = vi.fn();
  const ref: { current: BoardContextValue | null } = { current: null };
  function Probe() {
    const value = useBoard();
    ref.current = value;
    return <p data-testid="todo">{value.board.columns.TODO.join(",")}</p>;
  }
  render(
    <BoardProvider initialBoard={initial} repository={repo} onUnauthorized={onUnauthorized}>
      <Probe />
    </BoardProvider>,
  );
  return { ctx: () => ref.current!, repo, onUnauthorized };
}

const addCard = (id: string) =>
  ({ type: "ADD_CARD", id, title: id, description: "", now: T1 }) as const;
const move = (id: string, toStatus: "TODO" | "IN_PROGRESS" | "DONE", toIndex = 0) =>
  ({ type: "MOVE_CARD", id, toStatus, toIndex, now: T1 }) as const;

/** act 안에서 commit하고 서버 응답까지 기다린다. */
async function commitAndWait(ctx: () => BoardContextValue, ...actions: Parameters<BoardContextValue["commit"]>[0][]) {
  let results: boolean[] = [];
  await act(async () => {
    results = await Promise.all(actions.map((action) => ctx().commit(action)));
  });
  return results;
}

describe("BoardProvider 초기 상태", () => {
  it("서버가 넘긴 보드를 바로 보여준다 (plan D4)", () => {
    const { ctx } = renderProvider(makeBoard({ TODO: ["a", "b"] }));
    expect(ctx().isHydrated).toBe(true);
    expect(screen.getByTestId("todo")).toHaveTextContent("a,b");
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

describe("commit (T-023)", () => {
  it("화면에 바로 반영하고, 서버 저장에 성공하면 true다", async () => {
    const { ctx, repo } = renderProvider();
    repo.setDelay(20);
    let pending!: Promise<boolean>;
    act(() => {
      pending = ctx().commit(addCard("a"));
    });
    // 서버 응답 전에 이미 보인다(낙관적 업데이트).
    expect(screen.getByTestId("todo")).toHaveTextContent("a");
    expect(repo.board.columns.TODO).toEqual([]);

    await act(async () => {
      expect(await pending).toBe(true);
    });
    expect(repo.board.columns.TODO).toEqual(["a"]);
  });

  it("저장에 실패하면 서버에 확정된 상태로 되돌리고 알린다 (FR-22)", async () => {
    const { ctx, repo } = renderProvider(makeBoard({ TODO: ["a"] }));
    repo.failNext("server");
    expect(await commitAndWait(ctx, addCard("b"))).toEqual([false]);
    expect(ctx().board.columns.TODO).toEqual(["a"]);
    expect(ctx().toast?.message).toBe(MESSAGES.saveFailed);
  });

  it("연속 두 변경 중 첫 번째가 실패하면 두 변경을 모두 되돌리고, 두 번째는 보내지 않는다", async () => {
    const { ctx, repo } = renderProvider(makeBoard({ TODO: ["a"] }));
    repo.failNext("server");
    expect(await commitAndWait(ctx, addCard("b"), addCard("c"))).toEqual([false, false]);
    expect(ctx().board.columns.TODO).toEqual(["a"]);
    expect(repo.calls).toEqual(["addCard"]);
  });

  it("실패한 뒤의 새 변경은 정상적으로 저장된다", async () => {
    const { ctx, repo } = renderProvider();
    repo.failNext("network");
    await commitAndWait(ctx, addCard("a"));
    expect(await commitAndWait(ctx, addCard("b"))).toEqual([true]);
    expect(ctx().board.columns.TODO).toEqual(["b"]);
    expect(repo.board.columns.TODO).toEqual(["b"]);
  });

  it("앞선 변경이 성공한 뒤 실패하면 성공한 변경까지만 남긴다", async () => {
    const { ctx, repo } = renderProvider();
    await commitAndWait(ctx, addCard("a"));
    repo.failNext("server");
    await commitAndWait(ctx, move("a", "DONE"));
    expect(ctx().board.columns).toEqual({ TODO: ["a"], IN_PROGRESS: [], DONE: [] });
  });

  it("이동은 서버가 돌려준 보드로 화면을 맞춘다", async () => {
    const { ctx, repo } = renderProvider(makeBoard({ TODO: ["a", "b"] }));
    // 서버에만 있는 변화(다른 기기에서 추가된 카드)가 이동 응답으로 반영된다.
    await repo.addCard({ id: "z", title: "z", description: "" });
    await commitAndWait(ctx, move("a", "DONE"));
    expect(ctx().board.columns).toEqual({ TODO: ["b", "z"], IN_PROGRESS: [], DONE: ["a"] });
  });

  it("세션이 만료되면(401) 되돌리고 로그인 화면으로 보낸다 (FR-21)", async () => {
    const { ctx, repo, onUnauthorized } = renderProvider(makeBoard({ TODO: ["a"] }));
    repo.failNext("unauthorized");
    await commitAndWait(ctx, move("a", "DONE"));
    expect(ctx().board.columns.DONE).toEqual([]);
    expect(ctx().toast?.message).toBe(MESSAGES.sessionExpired);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("미리보기 중 실패하면 미리보기 이전(확정) 상태로 돌아간다", async () => {
    const { ctx, repo } = renderProvider(makeBoard({ TODO: ["a"] }));
    act(() => ctx().preview(move("a", "DONE")));
    expect(ctx().board.columns.DONE).toEqual(["a"]);
    repo.failNext("server");
    await commitAndWait(ctx, move("a", "IN_PROGRESS"));
    expect(ctx().board.columns).toEqual({ TODO: ["a"], IN_PROGRESS: [], DONE: [] });
  });

  it("preview는 저장하지 않는다", () => {
    const { ctx, repo } = renderProvider();
    act(() => ctx().preview(addCard("a")));
    expect(repo.calls).toEqual([]);
    expect(ctx().board.columns.TODO).toEqual(["a"]);
  });

  it("바뀌는 것이 없으면 서버에 보내지 않는다", async () => {
    const { ctx, repo } = renderProvider(makeBoard({ TODO: ["a"] }));
    expect(await commitAndWait(ctx, move("a", "TODO", 0))).toEqual([true]);
    expect(repo.calls).toEqual([]);
  });

  it("드래그 중에는 서버 응답으로 화면을 다시 맞추지 않는다", async () => {
    const { ctx, repo } = renderProvider(makeBoard({ TODO: ["a", "b"] }));
    await repo.addCard({ id: "z", title: "z", description: "" });
    act(() => ctx().setDragging(true));
    await commitAndWait(ctx, move("a", "DONE"));
    expect(ctx().board.columns.TODO).toEqual(["b"]);
  });
});

describe("importBoard (FR-25)", () => {
  it("성공하면 서버 보드로 바꾸고 알린다", async () => {
    const { ctx } = renderProvider();
    const stored = { version: 1, savedAt: T1, board: makeBoard({ DONE: ["x"] }) };
    let ok = false;
    await act(async () => {
      ok = await ctx().importBoard(stored);
    });
    expect(ok).toBe(true);
    expect(ctx().board.columns.DONE).toEqual(["x"]);
    expect(ctx().toast?.message).toBe(MESSAGES.imported);
  });

  it("실패하면 보드를 그대로 두고 알린다", async () => {
    const { ctx, repo } = renderProvider();
    repo.failNext("server");
    await act(async () => {
      await ctx().importBoard({});
    });
    expect(ctx().board.columns.DONE).toEqual([]);
    expect(ctx().toast?.message).toBe(MESSAGES.importFailed);
  });
});
