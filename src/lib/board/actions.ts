import type { BoardState, Status } from "./types";

/**
 * 보드 상태를 바꾸는 액션. id와 now는 호출하는 쪽에서 넘겨
 * 리듀서를 순수 함수로 유지한다 (plan §5.1).
 */
export type BoardAction =
  | { type: "HYDRATE"; board: BoardState }
  | { type: "ADD_CARD"; id: string; title: string; description: string; now: string }
  | { type: "UPDATE_CARD"; id: string; title: string; description: string; now: string }
  | { type: "DELETE_CARD"; id: string }
  | { type: "MOVE_CARD"; id: string; toStatus: Status; toIndex: number; now: string }
  | { type: "RESTORE"; board: BoardState };
