import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { moveCard as moveCardInBoard, normalizeBoard } from "@/lib/board/operations";
import { storedBoardSchema, type CardInput } from "@/lib/board/schema";
import { STATUSES, type BoardState, type Card, type Status } from "@/lib/board/types";
import { migrate } from "@/lib/storage/migrations";
import { getPool } from "@/server/db/pool";
import { withTransaction } from "@/server/db/tx";
import { rowToCard, rowsToBoard, type CardRow } from "./rowsToBoard";

// 보드 데이터 접근. 모든 함수는 세션에서 얻은 boardId를 첫 인자로 받고,
// 모든 SQL에 board_id 조건을 넣는다. userId나 클라이언트가 보낸 boardId를 받는 함수는 없다 (plan §3 규칙 3).

export type QueryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: "not_found" | "conflict" | "invalid" };

type Queryable = Pick<PoolClient, "query">;

const ok = <T>(value: T): QueryResult<T> => ({ ok: true, value });
const notFound = { ok: false, error: "not_found" } as const;

export async function getBoard(boardId: string, db: Queryable = getPool()): Promise<BoardState> {
  const { rows } = await db.query<CardRow>(
    `SELECT id, title, description, status, position, created_at, updated_at
       FROM cards
      WHERE board_id = $1
      ORDER BY status, position`,
    [boardId],
  );
  return rowsToBoard(rows);
}

/** 같은 보드에 대한 변경을 직렬화한다 (plan §3 규칙 4). */
async function lockBoard(client: PoolClient, boardId: string): Promise<boolean> {
  const { rowCount } = await client.query("SELECT id FROM boards WHERE id = $1 FOR UPDATE", [
    boardId,
  ]);
  return rowCount === 1;
}

export function addCard(
  boardId: string,
  input: CardInput & { id: string },
): Promise<QueryResult<Card>> {
  return withTransaction(async (client) => {
    if (!(await lockBoard(client, boardId))) return notFound;
    // id 충돌(0행)은 존재 여부를 드러내지 않도록 not_found로 답한다 (plan D3).
    const { rows } = await client.query<CardRow>(
      `INSERT INTO cards (id, board_id, title, description, status, position)
       SELECT $1, $2, $3, $4, 'TODO', count(*)::int FROM cards WHERE board_id = $2 AND status = 'TODO'
       ON CONFLICT (id) DO NOTHING
       RETURNING id, title, description, status, position, created_at, updated_at`,
      [input.id, boardId, input.title, input.description],
    );
    return rows[0] ? ok(rowToCard(rows[0])) : notFound;
  });
}

export async function updateCard(
  boardId: string,
  id: string,
  input: CardInput,
): Promise<QueryResult<Card>> {
  const { rows } = await getPool().query<CardRow>(
    `UPDATE cards SET title = $3, description = $4, updated_at = now()
      WHERE id = $1 AND board_id = $2
      RETURNING id, title, description, status, position, created_at, updated_at`,
    [id, boardId, input.title, input.description],
  );
  return rows[0] ? ok(rowToCard(rows[0])) : notFound;
}

export function deleteCard(boardId: string, id: string): Promise<QueryResult<null>> {
  return withTransaction(async (client) => {
    if (!(await lockBoard(client, boardId))) return notFound;
    const { rows } = await client.query<{ status: Status; position: number }>(
      "DELETE FROM cards WHERE id = $1 AND board_id = $2 RETURNING status, position",
      [id, boardId],
    );
    const removed = rows[0];
    if (!removed) return notFound;
    await client.query(
      `UPDATE cards SET position = position - 1
        WHERE board_id = $1 AND status = $2 AND position > $3`,
      [boardId, removed.status, removed.position],
    );
    return ok(null);
  });
}

export interface MoveHooks {
  /** 테스트용: 순서를 갱신한 뒤, 커밋 전에 실행된다. */
  afterUpdate?: () => Promise<void>;
}

/**
 * 카드를 toStatus 컬럼의 toIndex 위치로 옮긴다.
 * 클라이언트는 카드 하나만 지정하고, 나머지 카드의 순서는 서버가 자기 보드의 카드로만 다시 계산한다.
 * 그래서 다른 유저의 카드가 섞인 다중 변경은 만들어질 수 없다 (plan D1, FR-20).
 */
export function moveCard(
  boardId: string,
  id: string,
  toStatus: Status,
  toIndex: number,
  hooks: MoveHooks = {},
): Promise<QueryResult<BoardState>> {
  return withTransaction(async (client) => {
    if (!(await lockBoard(client, boardId))) return notFound;
    const board = await getBoard(boardId, client);
    const fromStatus = board.cards[id]?.status;
    if (!fromStatus) return notFound;

    const next = moveCardInBoard(board, id, toStatus, toIndex, new Date().toISOString());
    if (next === board) return ok(board);

    const affected = new Set<Status>([fromStatus, toStatus]);
    const ids: string[] = [];
    const statuses: Status[] = [];
    const positions: number[] = [];
    for (const status of affected) {
      next.columns[status].forEach((cardId, position) => {
        ids.push(cardId);
        statuses.push(status);
        positions.push(position);
      });
    }

    // SET 절의 c.status는 갱신 전 값이다. 상태가 바뀐 카드만 updated_at을 갱신한다.
    const { rowCount } = await client.query(
      `UPDATE cards AS c
          SET status = v.status,
              position = v.position,
              updated_at = CASE WHEN c.status <> v.status THEN now() ELSE c.updated_at END
         FROM unnest($1::uuid[], $2::text[], $3::int[]) AS v(id, status, position)
        WHERE c.id = v.id AND c.board_id = $4`,
      [ids, statuses, positions, boardId],
    );
    if (rowCount !== ids.length) throw new Error("이동 중 카드 수가 맞지 않습니다.");
    await hooks.afterUpdate?.();
    return ok(await getBoard(boardId, client));
  });
}

/**
 * 기존 localStorage 보드를 가져온다 (FR-25). 보드가 비어 있을 때만 가능하다.
 * 카드 id는 서버가 새로 발급하고, 원본의 생성·수정 시각은 유지한다.
 */
export function importBoard(boardId: string, stored: unknown): Promise<QueryResult<BoardState>> {
  const parsed = storedBoardSchema.safeParse(migrate(stored));
  if (!parsed.success) return Promise.resolve({ ok: false, error: "invalid" } as const);
  const source = normalizeBoard(parsed.data.board);

  return withTransaction(async (client) => {
    if (!(await lockBoard(client, boardId))) return notFound;
    const { rowCount } = await client.query("SELECT 1 FROM cards WHERE board_id = $1 LIMIT 1", [
      boardId,
    ]);
    if (rowCount) return { ok: false, error: "conflict" } as const;

    const rows = STATUSES.flatMap((status) =>
      source.columns[status].map((oldId, position) => ({ ...source.cards[oldId], status, position })),
    );
    if (rows.length) {
      await client.query(
        `INSERT INTO cards (id, board_id, title, description, status, position, created_at, updated_at)
         SELECT v.id, $1, v.title, v.description, v.status, v.position, v.created_at, v.updated_at
           FROM unnest($2::uuid[], $3::text[], $4::text[], $5::text[], $6::int[], $7::timestamptz[], $8::timestamptz[])
             AS v(id, title, description, status, position, created_at, updated_at)`,
        [
          boardId,
          rows.map(() => randomUUID()),
          rows.map((row) => row.title),
          rows.map((row) => row.description),
          rows.map((row) => row.status),
          rows.map((row) => row.position),
          rows.map((row) => row.createdAt),
          rows.map((row) => row.updatedAt),
        ],
      );
    }
    return ok(await getBoard(boardId, client));
  });
}
