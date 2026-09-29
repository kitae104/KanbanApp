import { describe, expect, it } from "vitest";
import {
  findContainer,
  moveCard,
  normalizeBoard,
  syncDerivedFields,
} from "@/lib/board/operations";
import { STATUSES, type BoardState, type Status } from "@/lib/board/types";
import { T0, T1, makeBoard } from "./helpers";

/** 모든 카드의 status/order가 컬럼 위치와 일치하는지 확인한다(C2). */
function expectConsistent(board: BoardState) {
  const placed = STATUSES.flatMap((s) => board.columns[s]);
  expect(new Set(placed).size).toBe(placed.length);
  expect(Object.keys(board.cards).sort()).toEqual([...placed].sort());
  for (const status of STATUSES) {
    board.columns[status].forEach((id, index) => {
      expect(board.cards[id]).toMatchObject({ status, order: index });
    });
  }
}

describe("syncDerivedFields", () => {
  it("columns 기준으로 status와 order를 다시 계산한다", () => {
    const board = makeBoard({ TODO: ["a", "b"] });
    board.cards.a = { ...board.cards.a, status: "DONE", order: 7 };
    const synced = syncDerivedFields(board);
    expect(synced.cards.a).toMatchObject({ status: "TODO", order: 0 });
    expectConsistent(synced);
  });
});

describe("normalizeBoard", () => {
  it("cards에 없는 id와 중복 id를 columns에서 제거한다", () => {
    const board = makeBoard({ TODO: ["a"], DONE: ["b"] });
    board.columns.TODO.push("ghost", "b");
    const normalized = normalizeBoard(board);
    expect(normalized.columns).toEqual({ TODO: ["a", "b"], IN_PROGRESS: [], DONE: [] });
    expectConsistent(normalized);
  });

  it("어느 컬럼에도 없는 카드와 key·id가 다른 카드를 제거한다", () => {
    const board = makeBoard({ TODO: ["a"] });
    board.cards.orphan = { ...board.cards.a, id: "orphan" };
    board.cards.x = { ...board.cards.a, id: "y" };
    board.columns.DONE.push("x");
    const normalized = normalizeBoard(board);
    expect(Object.keys(normalized.cards)).toEqual(["a"]);
    expect(normalized.columns.DONE).toEqual([]);
  });
});

describe("findContainer", () => {
  const board = makeBoard({ TODO: ["a"], DONE: ["b"] });

  it("카드 id면 카드가 있는 컬럼을 준다", () => {
    expect(findContainer(board, "b")).toBe("DONE");
  });

  it("컬럼 id면 그 컬럼을 준다", () => {
    expect(findContainer(board, "IN_PROGRESS")).toBe("IN_PROGRESS");
  });

  it("없는 id면 undefined를 준다", () => {
    expect(findContainer(board, "nope")).toBeUndefined();
  });
});

describe("moveCard", () => {
  const directions: [Status, Status][] = STATUSES.flatMap((from) =>
    STATUSES.filter((to) => to !== from).map((to): [Status, Status] => [from, to]),
  );

  it("6가지 이동 방향이 있다", () => {
    expect(directions).toHaveLength(6);
  });

  it.each(directions)("%s → %s 이동 시 status가 대상 컬럼이 된다 (SC-3)", (from, to) => {
    const board = makeBoard({ [from]: ["a", "b"], [to]: ["c"] });
    const moved = moveCard(board, "a", to, 1, T1);
    expect(moved.cards.a).toMatchObject({ status: to, order: 1, updatedAt: T1 });
    expect(moved.columns[to]).toEqual(["c", "a"]);
    expect(moved.columns[from]).toEqual(["b"]);
    expectConsistent(moved);
  });

  it("같은 컬럼 재정렬은 status와 updatedAt을 유지하고 순서만 바꾼다 (SC-4)", () => {
    const board = makeBoard({ IN_PROGRESS: ["a", "b", "c"] });
    const moved = moveCard(board, "a", "IN_PROGRESS", 2, T1);
    expect(moved.columns.IN_PROGRESS).toEqual(["b", "c", "a"]);
    expect(moved.cards.a).toMatchObject({ status: "IN_PROGRESS", order: 2, updatedAt: T0 });
    expectConsistent(moved);
  });

  it("빈 컬럼으로 옮길 수 있다 (FR-16)", () => {
    const moved = moveCard(makeBoard({ TODO: ["a"] }), "a", "DONE", 0, T1);
    expect(moved.columns).toEqual({ TODO: [], IN_PROGRESS: [], DONE: ["a"] });
  });

  it.each([
    [0, ["a", "x", "y"]],
    [1, ["x", "a", "y"]],
    [2, ["x", "y", "a"]],
  ])("대상 인덱스 %i에 삽입한다 (FR-12)", (index, expected) => {
    const moved = moveCard(makeBoard({ TODO: ["a"], DONE: ["x", "y"] }), "a", "DONE", index, T1);
    expect(moved.columns.DONE).toEqual(expected);
  });

  it("범위를 벗어난 인덱스는 양 끝으로 보정한다", () => {
    const board = makeBoard({ TODO: ["a"], DONE: ["x"] });
    expect(moveCard(board, "a", "DONE", 99, T1).columns.DONE).toEqual(["x", "a"]);
    expect(moveCard(board, "a", "DONE", -3, T1).columns.DONE).toEqual(["a", "x"]);
  });

  it("원본 보드를 변경하지 않는다", () => {
    const board = makeBoard({ TODO: ["a", "b"] });
    const snapshot = structuredClone(board);
    moveCard(board, "a", "DONE", 0, T1);
    expect(board).toEqual(snapshot);
  });

  it("없는 카드거나 위치가 그대로면 같은 보드 객체를 돌려준다", () => {
    const board = makeBoard({ TODO: ["a", "b"] });
    expect(moveCard(board, "nope", "DONE", 0, T1)).toBe(board);
    expect(moveCard(board, "b", "TODO", 1, T1)).toBe(board);
  });
});
