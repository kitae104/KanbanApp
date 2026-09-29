import { resolveDropTarget } from "./dnd";
import { findContainer } from "./operations";
import { STATUS_LABEL, type BoardState } from "./types";

/** 스크린리더용 드래그 안내 문구 (NFR-5). */
export const SCREEN_READER_INSTRUCTIONS =
  "카드를 집으려면 스페이스바나 Enter 키를 누르세요. 방향키로 옮기고, 스페이스바나 Enter 키로 내려놓으세요. 취소하려면 Esc 키를 누르세요.";

export const CARD_ROLE_DESCRIPTION = "이동 가능한 카드";

function titleOf(board: BoardState, id: string) {
  return board.cards[id]?.title ?? "카드";
}

function currentPosition(board: BoardState, id: string) {
  const status = findContainer(board, id);
  if (!status) return "";
  return `${STATUS_LABEL[status]} 컬럼 ${board.columns[status].indexOf(id) + 1}번째`;
}

function targetPosition(board: BoardState, activeId: string, overId: string) {
  const target = resolveDropTarget(board, activeId, overId);
  if (!target) return null;
  return `${STATUS_LABEL[target.status]} 컬럼 ${target.index + 1}번째`;
}

export const announce = {
  dragStart(board: BoardState, activeId: string) {
    return `'${titleOf(board, activeId)}' 카드를 집었습니다. 현재 ${currentPosition(board, activeId)} 위치입니다.`;
  },
  /** 제자리(over가 자기 자신)면 안내하지 않아 "집었습니다" 안내가 덮이지 않게 한다. */
  dragOver(board: BoardState, activeId: string, overId: string | null) {
    if (overId === activeId) return undefined;
    const position = overId && targetPosition(board, activeId, overId);
    return position ? `${position} 위치로 이동했습니다.` : "카드를 놓을 수 없는 영역입니다.";
  },
  dragEnd(board: BoardState, activeId: string, overId: string | null) {
    const position = overId && targetPosition(board, activeId, overId);
    const title = titleOf(board, activeId);
    return position
      ? `'${title}' 카드를 ${position} 위치에 놓았습니다.`
      : `놓을 수 없는 영역이라 '${title}' 카드가 원래 위치로 돌아갔습니다.`;
  },
  dragCancel(board: BoardState, activeId: string) {
    return `이동을 취소했습니다. '${titleOf(board, activeId)}' 카드가 원래 위치로 돌아갔습니다.`;
  },
};
