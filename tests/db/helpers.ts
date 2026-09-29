import { randomUUID } from "node:crypto";
import { query } from "@/server/db/pool";

export interface TestUser {
  userId: string;
  email: string;
  boardId: string;
}

/** 해시 계산 없이 유저와 보드를 만든다(데이터 계층 테스트용). */
export async function createUser(email = `${randomUUID()}@test.local`): Promise<TestUser> {
  const { rows } = await query<{ id: string }>(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'test-hash') RETURNING id",
    [email],
  );
  const userId = rows[0].id;
  const board = await query<{ id: string }>(
    "INSERT INTO boards (user_id) VALUES ($1) RETURNING id",
    [userId],
  );
  return { userId, email, boardId: board.rows[0].id };
}

export interface CardRow {
  id: string;
  title: string;
  status: string;
  position: number;
  updated_at: Date;
}

export async function cardRows(boardId: string): Promise<CardRow[]> {
  const { rows } = await query<CardRow>(
    "SELECT id, title, status, position, updated_at FROM cards WHERE board_id = $1 ORDER BY status, position",
    [boardId],
  );
  return rows;
}

/** 컬럼마다 position이 0..n-1로 연속인지 확인한다. */
export function positionsAreContiguous(rows: CardRow[]): boolean {
  const byStatus = new Map<string, number[]>();
  for (const row of rows) byStatus.set(row.status, [...(byStatus.get(row.status) ?? []), row.position]);
  return [...byStatus.values()].every((positions) =>
    positions.every((position, index) => position === index),
  );
}
