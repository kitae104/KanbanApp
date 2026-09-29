import { findContainer } from "./operations";
import { isStatus, type BoardState, type Status } from "./types";

export interface DropTarget {
  status: Status;
  /** 이동 후 대상 컬럼 목록에서의 위치. */
  index: number;
}

/**
 * 드래그 중인 카드(activeId)를 over 대상(카드 또는 컬럼) 위에 놓았을 때의 위치를 계산한다.
 * - 컬럼 위: 그 컬럼의 맨 끝
 * - 같은 컬럼의 카드 위: 그 카드의 자리(arrayMove와 같은 의미)
 * - 다른 컬럼의 카드 위: 그 카드 앞, placeAfter면 그 카드 뒤
 */
export function resolveDropTarget(
  board: BoardState,
  activeId: string,
  overId: string,
  placeAfter = false,
): DropTarget | null {
  const status = findContainer(board, overId);
  if (!status || !board.cards[activeId]) return null;

  const others = board.columns[status].filter((id) => id !== activeId);
  if (isStatus(overId)) return { status, index: others.length };

  const overIndex = board.columns[status].indexOf(overId);
  if (overId === activeId || findContainer(board, activeId) === status) {
    return { status, index: overIndex };
  }
  return { status, index: overIndex + (placeAfter ? 1 : 0) };
}
