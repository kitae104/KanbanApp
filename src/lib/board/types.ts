export const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  TODO: "할 일",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
};

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;

export interface Card {
  id: string;
  title: string;
  description: string;
  /** columns에서 파생된다. 리듀서가 항상 동기화한다. */
  status: Status;
  /** 컬럼 안의 0-based 위치. columns에서 파생된다. */
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardState {
  cards: Record<string, Card>;
  /** 상태별 카드 순서. 카드 위치와 상태의 단일 기준이다(C2). */
  columns: Record<Status, string[]>;
}

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}
