import type { BoardState, Card, Status } from "@/lib/board/types";

export const T0 = "2026-01-01T00:00:00.000Z";
export const T1 = "2026-01-02T00:00:00.000Z";

/** 컬럼별 카드 id 목록으로 status/order가 맞춰진 보드를 만든다. */
export function makeBoard(layout: Partial<Record<Status, string[]>>): BoardState {
  const columns: Record<Status, string[]> = {
    TODO: [...(layout.TODO ?? [])],
    IN_PROGRESS: [...(layout.IN_PROGRESS ?? [])],
    DONE: [...(layout.DONE ?? [])],
  };
  const cards: Record<string, Card> = {};
  for (const status of Object.keys(columns) as Status[]) {
    columns[status].forEach((id, order) => {
      cards[id] = {
        id,
        title: `카드 ${id}`,
        description: "",
        status,
        order,
        createdAt: T0,
        updatedAt: T0,
      };
    });
  }
  return { cards, columns };
}
