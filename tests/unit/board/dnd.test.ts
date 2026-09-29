import { describe, expect, it } from "vitest";
import { announce } from "@/lib/board/a11y";
import { resolveDropTarget } from "@/lib/board/dnd";
import { makeBoard } from "./helpers";

const board = makeBoard({ TODO: ["a", "b", "c"], IN_PROGRESS: ["x", "y"] });

describe("resolveDropTarget (T-021)", () => {
  it("컬럼 위에 놓으면 그 컬럼 맨 끝", () => {
    expect(resolveDropTarget(board, "a", "IN_PROGRESS")).toEqual({ status: "IN_PROGRESS", index: 2 });
    expect(resolveDropTarget(board, "a", "TODO")).toEqual({ status: "TODO", index: 2 });
  });

  it("빈 컬럼 위에 놓으면 0번째", () => {
    expect(resolveDropTarget(board, "a", "DONE")).toEqual({ status: "DONE", index: 0 });
  });

  it("같은 컬럼 카드 위에 놓으면 그 카드 자리", () => {
    expect(resolveDropTarget(board, "a", "c")).toEqual({ status: "TODO", index: 2 });
    expect(resolveDropTarget(board, "c", "a")).toEqual({ status: "TODO", index: 0 });
    expect(resolveDropTarget(board, "b", "b")).toEqual({ status: "TODO", index: 1 });
  });

  it("다른 컬럼 카드 위에 놓으면 그 카드 앞, placeAfter면 뒤", () => {
    expect(resolveDropTarget(board, "a", "y")).toEqual({ status: "IN_PROGRESS", index: 1 });
    expect(resolveDropTarget(board, "a", "y", true)).toEqual({ status: "IN_PROGRESS", index: 2 });
  });

  it("알 수 없는 대상이나 카드면 null", () => {
    expect(resolveDropTarget(board, "a", "nope")).toBeNull();
    expect(resolveDropTarget(board, "nope", "TODO")).toBeNull();
  });
});

describe("스크린리더 안내 문구 (T-023)", () => {
  it("집을 때 현재 위치를 알린다", () => {
    expect(announce.dragStart(board, "b")).toBe(
      "'카드 b' 카드를 집었습니다. 현재 할 일 컬럼 2번째 위치입니다.",
    );
  });

  it("이동 중 대상 위치를 알린다", () => {
    expect(announce.dragOver(board, "a", "IN_PROGRESS")).toBe("진행 중 컬럼 3번째 위치로 이동했습니다.");
    expect(announce.dragOver(board, "a", null)).toBe("카드를 놓을 수 없는 영역입니다.");
  });

  it("제자리에서는 안내하지 않는다", () => {
    expect(announce.dragOver(board, "a", "a")).toBeUndefined();
  });

  it("놓을 때 결과를 알린다", () => {
    expect(announce.dragEnd(board, "a", "DONE")).toBe("'카드 a' 카드를 완료 컬럼 1번째 위치에 놓았습니다.");
    expect(announce.dragEnd(board, "a", null)).toBe(
      "놓을 수 없는 영역이라 '카드 a' 카드가 원래 위치로 돌아갔습니다.",
    );
  });

  it("취소를 알린다", () => {
    expect(announce.dragCancel(board, "x")).toBe(
      "이동을 취소했습니다. '카드 x' 카드가 원래 위치로 돌아갔습니다.",
    );
  });
});
