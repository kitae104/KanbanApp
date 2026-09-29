/**
 * 테스트·수동 확인용 저장 데이터 생성기 (T-025).
 * E2E와 수동 확인에서 localStorage["kanban-app:board"]에 그대로 넣을 수 있는 값을 만든다.
 */
type Status = "TODO" | "IN_PROGRESS" | "DONE";

const T0 = "2026-01-01T00:00:00.000Z";

export function buildStoredBoard(layout: Partial<Record<Status, string[]>>) {
  const columns: Record<Status, string[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  const cards: Record<string, unknown> = {};
  for (const status of Object.keys(columns) as Status[]) {
    (layout[status] ?? []).forEach((title, order) => {
      const id = `${status.toLowerCase()}-${order}`;
      columns[status].push(id);
      cards[id] = {
        id,
        title,
        description: "",
        status,
        order,
        createdAt: T0,
        updatedAt: T0,
      };
    });
  }
  return { version: 1, savedAt: T0, board: { cards, columns } };
}

/** 컬럼당 perColumn장, 설명이 채워진 대량 보드 (SC-9: 200 × 3 = 600장). */
export function buildLargeBoard(perColumn = 200) {
  const titles = (prefix: string) =>
    Array.from({ length: perColumn }, (_, i) => `${prefix} 작업 ${i + 1}`);
  const stored = buildStoredBoard({
    TODO: titles("할 일"),
    IN_PROGRESS: titles("진행"),
    DONE: titles("완료"),
  });
  for (const card of Object.values(stored.board.cards) as { description: string }[]) {
    card.description = "설명 ".repeat(40).trim();
  }
  return stored;
}
