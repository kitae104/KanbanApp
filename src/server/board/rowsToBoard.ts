import "server-only";

import { createEmptyBoard } from "@/lib/board/operations";
import { isStatus, type BoardState, type Card } from "@/lib/board/types";

export interface CardRow {
  id: string;
  title: string;
  description: string;
  status: string;
  position: number;
  created_at: Date;
  updated_at: Date;
}

export function rowToCard(row: CardRow): Card {
  if (!isStatus(row.status)) throw new Error(`알 수 없는 상태: ${row.status}`);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    order: row.position,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** DB 행을 BoardState로 바꾼다. 컬럼 안 순서는 position 기준이다 (plan D6). */
export function rowsToBoard(rows: CardRow[]): BoardState {
  const board = createEmptyBoard();
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  for (const row of sorted) {
    const card = rowToCard(row);
    board.cards[card.id] = card;
    board.columns[card.status].push(card.id);
  }
  return board;
}
