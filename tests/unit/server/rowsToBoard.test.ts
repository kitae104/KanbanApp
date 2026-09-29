import { describe, expect, it } from "vitest";
import { boardStateSchema } from "@/lib/board/schema";
import { rowsToBoard, type CardRow } from "@/server/board/rowsToBoard";

const at = new Date("2026-09-29T00:00:00.000Z");
const row = (id: string, status: string, position: number): CardRow => ({
  id,
  title: `카드 ${id}`,
  description: "",
  status,
  position,
  created_at: at,
  updated_at: at,
});

describe("rowsToBoard", () => {
  it("빈 목록은 빈 보드다", () => {
    expect(rowsToBoard([])).toEqual({ cards: {}, columns: { TODO: [], IN_PROGRESS: [], DONE: [] } });
  });

  it("행 순서와 관계없이 position 순으로 컬럼을 채우고 order에 매핑한다", () => {
    const board = rowsToBoard([row("b", "TODO", 1), row("c", "DONE", 0), row("a", "TODO", 0)]);
    expect(board.columns).toEqual({ TODO: ["a", "b"], IN_PROGRESS: [], DONE: ["c"] });
    expect(board.cards.b).toMatchObject({ status: "TODO", order: 1, createdAt: at.toISOString() });
    expect(boardStateSchema.safeParse(board).success).toBe(true);
  });

  it("알 수 없는 상태는 예외다", () => {
    expect(() => rowsToBoard([row("a", "DOING", 0)])).toThrow();
  });
});
