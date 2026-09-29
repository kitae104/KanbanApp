import { describe, expect, it } from "vitest";
import { moveCard } from "@/lib/board/operations";
import { boardReducer } from "@/lib/board/reducer";
import { T0, T1, makeBoard } from "./helpers";

describe("boardReducer", () => {
  it("ADD_CARD는 TODO 맨 뒤에 카드를 추가한다 (SC-2)", () => {
    const board = makeBoard({ TODO: ["a"], DONE: ["b"] });
    const next = boardReducer(board, {
      type: "ADD_CARD",
      id: "new",
      title: "보고서",
      description: "초안",
      now: T1,
    });
    expect(next.columns.TODO).toEqual(["a", "new"]);
    expect(next.cards.new).toEqual({
      id: "new",
      title: "보고서",
      description: "초안",
      status: "TODO",
      order: 1,
      createdAt: T1,
      updatedAt: T1,
    });
  });

  it("ADD_CARD는 이미 있는 id를 무시한다", () => {
    const board = makeBoard({ TODO: ["a"] });
    const next = boardReducer(board, {
      type: "ADD_CARD",
      id: "a",
      title: "x",
      description: "",
      now: T1,
    });
    expect(next).toBe(board);
  });

  it("UPDATE_CARD는 제목·설명·updatedAt만 바꾼다", () => {
    const board = makeBoard({ IN_PROGRESS: ["a"] });
    const next = boardReducer(board, {
      type: "UPDATE_CARD",
      id: "a",
      title: "새 제목",
      description: "새 설명",
      now: T1,
    });
    expect(next.cards.a).toMatchObject({
      title: "새 제목",
      description: "새 설명",
      status: "IN_PROGRESS",
      createdAt: T0,
      updatedAt: T1,
    });
  });

  it("UPDATE_CARD는 없는 카드를 무시한다", () => {
    const board = makeBoard({});
    const next = boardReducer(board, {
      type: "UPDATE_CARD",
      id: "x",
      title: "t",
      description: "",
      now: T1,
    });
    expect(next).toBe(board);
  });

  it("DELETE_CARD는 카드를 지우고 order를 다시 계산한다", () => {
    const board = makeBoard({ TODO: ["a", "b", "c"] });
    const next = boardReducer(board, { type: "DELETE_CARD", id: "a" });
    expect(next.columns.TODO).toEqual(["b", "c"]);
    expect(next.cards.a).toBeUndefined();
    expect(next.cards.c.order).toBe(1);
    expect(boardReducer(next, { type: "DELETE_CARD", id: "a" })).toBe(next);
  });

  it("MOVE_CARD는 moveCard와 같은 결과를 낸다", () => {
    const board = makeBoard({ TODO: ["a"], DONE: ["b"] });
    const next = boardReducer(board, {
      type: "MOVE_CARD",
      id: "a",
      toStatus: "DONE",
      toIndex: 0,
      now: T1,
    });
    expect(next).toEqual(moveCard(board, "a", "DONE", 0, T1));
  });

  it("HYDRATE와 RESTORE는 전달한 보드로 교체한다", () => {
    const board = makeBoard({ TODO: ["a"] });
    const other = makeBoard({ DONE: ["z"] });
    expect(boardReducer(board, { type: "HYDRATE", board: other })).toBe(other);
    expect(boardReducer(board, { type: "RESTORE", board: other })).toBe(other);
  });
});
