import { describe, expect, it } from "vitest";
import { createEmptyBoard } from "@/lib/board/operations";
import { STATUSES, STATUS_LABEL } from "@/lib/board/types";

describe("도메인 상수", () => {
  it("상태는 할 일 → 진행 중 → 완료 순서다", () => {
    expect(STATUSES).toEqual(["TODO", "IN_PROGRESS", "DONE"]);
    expect(STATUSES.map((s) => STATUS_LABEL[s])).toEqual(["할 일", "진행 중", "완료"]);
  });

  it("빈 보드는 카드 0장, 컬럼 3개다", () => {
    const board = createEmptyBoard();
    expect(board.cards).toEqual({});
    expect(Object.keys(board.columns)).toEqual(["TODO", "IN_PROGRESS", "DONE"]);
    expect(Object.values(board.columns).every((ids) => ids.length === 0)).toBe(true);
  });
});
