import type { CreateCardBody } from "@/lib/board/api";
import type { CardInput } from "@/lib/board/schema";
import type { BoardState, Card, Status } from "@/lib/board/types";

// 서버 보드 저장소 (plan §5.3). 모든 변경은 서버에 확정된 뒤에만 성공으로 본다.

export type RepoError = "unauthorized" | "not_found" | "invalid" | "conflict" | "network" | "server";
export type RepoResult<T = null> = { ok: true; value: T } | { ok: false; error: RepoError };

export interface BoardRepository {
  addCard(input: CreateCardBody): Promise<RepoResult<Card>>;
  updateCard(id: string, input: CardInput): Promise<RepoResult<Card>>;
  deleteCard(id: string): Promise<RepoResult>;
  /** 서버가 다시 계산한 보드 전체를 돌려준다. */
  moveCard(id: string, toStatus: Status, toIndex: number): Promise<RepoResult<BoardState>>;
  /** 이 브라우저의 localStorage 보드(저장 형식 그대로)를 빈 서버 보드로 가져온다. */
  importBoard(stored: unknown): Promise<RepoResult<BoardState>>;
}

// 아래는 로그인 전 localStorage 보드용이다. 이제는 가져오기 원본을 읽는 데만 쓴다 (FR-25).

export type LoadResult =
  | { ok: true; board: BoardState }
  | { ok: false; reason: "empty" | "corrupt" | "unavailable" };

export type SaveResult = { ok: true } | { ok: false; error: "quota" | "unavailable" | "unknown" };

export interface LocalBoardStore {
  load(): LoadResult;
  save(board: BoardState): SaveResult;
  /** 가져오기가 끝난 원본을 백업 키로 옮긴다. */
  archive(): void;
}
