import type { BoardState } from "@/lib/board/types";

export type LoadResult =
  | { ok: true; board: BoardState }
  | { ok: false; reason: "empty" | "corrupt" | "unavailable" };

export type SaveResult = { ok: true } | { ok: false; error: "quota" | "unavailable" | "unknown" };

/** 보드 저장소. 나중에 백엔드 API 구현체로 바꿀 수 있게 추상화한다 (plan §3 결정 5). */
export interface BoardRepository {
  load(): LoadResult;
  save(board: BoardState): SaveResult;
}
