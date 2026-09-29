import { STATUSES, isStatus, type BoardState, type Card, type Status } from "./types";

export function createEmptyBoard(): BoardState {
  return { cards: {}, columns: { TODO: [], IN_PROGRESS: [], DONE: [] } };
}

/** columns 순서를 기준으로 각 카드의 status/order를 다시 계산한다. */
export function syncDerivedFields(board: BoardState): BoardState {
  const cards: Record<string, Card> = { ...board.cards };
  for (const status of STATUSES) {
    board.columns[status].forEach((id, order) => {
      const card = cards[id];
      if (card && (card.status !== status || card.order !== order)) {
        cards[id] = { ...card, status, order };
      }
    });
  }
  return { cards, columns: board.columns };
}

/**
 * 외부에서 들어온 보드의 무결성을 맞춘다.
 * 카드가 없는 id, 중복 id, 어느 컬럼에도 없는 카드, key와 id가 다른 카드를 제거한다.
 */
export function normalizeBoard(board: BoardState): BoardState {
  const seen = new Set<string>();
  const columns = createEmptyBoard().columns;
  for (const status of STATUSES) {
    for (const id of board.columns[status]) {
      const card = board.cards[id];
      if (!card || card.id !== id || seen.has(id)) continue;
      seen.add(id);
      columns[status].push(id);
    }
  }
  const cards: Record<string, Card> = {};
  for (const id of seen) cards[id] = board.cards[id];
  return syncDerivedFields({ cards, columns });
}

/** id가 컬럼 id면 그 컬럼, 카드 id면 카드가 있는 컬럼을 돌려준다. */
export function findContainer(board: BoardState, id: string): Status | undefined {
  if (isStatus(id)) return id;
  return STATUSES.find((status) => board.columns[status].includes(id));
}

/**
 * 카드를 toStatus 컬럼의 toIndex 위치로 옮긴다(인덱스는 이동 후 목록 기준).
 * 상태가 바뀔 때만 updatedAt을 갱신한다. 변화가 없으면 같은 보드를 돌려준다.
 */
export function moveCard(
  board: BoardState,
  id: string,
  toStatus: Status,
  toIndex: number,
  now: string,
): BoardState {
  const card = board.cards[id];
  const fromStatus = card && findContainer(board, id);
  if (!card || !fromStatus || isStatus(id)) return board;

  const source = board.columns[fromStatus].filter((cardId) => cardId !== id);
  const target = fromStatus === toStatus ? source : [...board.columns[toStatus]];
  const index = Math.min(Math.max(toIndex, 0), target.length);
  if (fromStatus === toStatus && board.columns[fromStatus][index] === id) return board;

  target.splice(index, 0, id);
  const columns = { ...board.columns, [fromStatus]: source, [toStatus]: target };
  const cards =
    fromStatus === toStatus ? board.cards : { ...board.cards, [id]: { ...card, updatedAt: now } };
  return syncDerivedFields({ cards, columns });
}
