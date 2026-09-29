import { createEmptyBoard, moveCard, normalizeBoard } from "@/lib/board/operations";
import { boardReducer } from "@/lib/board/reducer";
import { storedBoardSchema } from "@/lib/board/schema";
import type { BoardState } from "@/lib/board/types";
import type { BoardRepository, RepoError, RepoResult } from "./boardRepository";

export interface MemoryBoardRepository extends BoardRepository {
  /** 서버에 확정된 보드. */
  readonly board: BoardState;
  /** 다음 호출 하나를 이 오류로 실패시킨다. */
  failNext(error: RepoError): void;
  /** 응답을 ms만큼 늦춘다. */
  setDelay(ms: number): void;
  calls: string[];
}

/** 네트워크 없이 서버 저장소처럼 동작하는 테스트용 구현. */
export function createMemoryBoardRepository(initial = createEmptyBoard()): MemoryBoardRepository {
  let board = initial;
  let nextError: RepoError | null = null;
  let delay = 0;
  const calls: string[] = [];
  const now = () => new Date().toISOString();

  async function run<T>(name: string, fn: () => RepoResult<T>): Promise<RepoResult<T>> {
    calls.push(name);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (nextError) {
      const error = nextError;
      nextError = null;
      return { ok: false, error };
    }
    return fn();
  }

  const notFound = { ok: false, error: "not_found" } as const;

  return {
    get board() {
      return board;
    },
    calls,
    failNext: (error) => {
      nextError = error;
    },
    setDelay: (ms) => {
      delay = ms;
    },
    addCard: (input) =>
      run("addCard", () => {
        if (board.cards[input.id]) return notFound;
        board = boardReducer(board, { type: "ADD_CARD", ...input, now: now() });
        return { ok: true, value: board.cards[input.id] };
      }),
    updateCard: (id, input) =>
      run("updateCard", () => {
        if (!board.cards[id]) return notFound;
        board = boardReducer(board, { type: "UPDATE_CARD", id, ...input, now: now() });
        return { ok: true, value: board.cards[id] };
      }),
    deleteCard: (id) =>
      run("deleteCard", () => {
        if (!board.cards[id]) return notFound;
        board = boardReducer(board, { type: "DELETE_CARD", id });
        return { ok: true, value: null };
      }),
    moveCard: (id, toStatus, toIndex) =>
      run("moveCard", () => {
        if (!board.cards[id]) return notFound;
        board = moveCard(board, id, toStatus, toIndex, now());
        return { ok: true, value: board };
      }),
    importBoard: (stored) =>
      run("importBoard", () => {
        if (Object.keys(board.cards).length) return { ok: false, error: "conflict" };
        const parsed = storedBoardSchema.safeParse(stored);
        if (!parsed.success) return { ok: false, error: "invalid" };
        board = normalizeBoard(parsed.data.board);
        return { ok: true, value: board };
      }),
  };
}
