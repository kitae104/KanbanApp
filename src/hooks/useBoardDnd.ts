"use client";

import type {
  Announcements,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useRef, useState } from "react";
import { announce } from "@/lib/board/a11y";
import { resolveDropTarget } from "@/lib/board/dnd";
import { findContainer } from "@/lib/board/operations";
import type { BoardState, Status } from "@/lib/board/types";
import { useBoard } from "./useBoard";

/** 드래그 중인 카드의 중심이 over 카드의 중심보다 아래면 그 뒤에 넣는다. */
function isBelowOver({ active, over }: DragOverEvent | DragEndEvent) {
  const rect = active.rect.current.translated;
  if (!rect || !over) return false;
  return rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2;
}

/**
 * 드래그 흐름 (plan §6.3)
 * - 시작: 스냅샷 저장
 * - 다른 컬럼 위: 저장 없이 미리보기로 카드를 옮겨 자리를 보여준다
 * - 놓기: 스냅샷 기준으로 최종 위치를 한 번 확정·저장
 * - 취소/컬럼 밖: 스냅샷으로 되돌린다
 */
export function useBoardDnd() {
  const { getBoard, commit, preview, setDragging } = useBoard();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<Status | null>(null);
  const snapshotRef = useRef<BoardState | null>(null);

  const finish = () => {
    snapshotRef.current = null;
    setActiveId(null);
    setOverStatus(null);
    setDragging(false);
  };

  const restoreSnapshot = () => {
    if (snapshotRef.current) preview({ type: "RESTORE", board: snapshotRef.current });
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    snapshotRef.current = getBoard();
    setActiveId(id);
    setOverStatus(findContainer(getBoard(), id) ?? null);
    setDragging(true);
  };

  const onDragOver = (event: DragOverEvent) => {
    const id = String(event.active.id);
    const board = getBoard();
    const target = event.over
      ? resolveDropTarget(board, id, String(event.over.id), isBelowOver(event))
      : null;
    setOverStatus(target?.status ?? null);
    if (target && target.status !== findContainer(board, id)) {
      preview({
        type: "MOVE_CARD",
        id,
        toStatus: target.status,
        toIndex: target.index,
        now: new Date().toISOString(),
      });
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const id = String(event.active.id);
    const target = event.over
      ? resolveDropTarget(getBoard(), id, String(event.over.id), isBelowOver(event))
      : null;
    restoreSnapshot();
    if (target) {
      commit({
        type: "MOVE_CARD",
        id,
        toStatus: target.status,
        toIndex: target.index,
        now: new Date().toISOString(),
      });
    }
    finish();
  };

  const onDragCancel = () => {
    restoreSnapshot();
    finish();
  };

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => announce.dragStart(getBoard(), String(active.id)),
      onDragOver: ({ active, over }) =>
        announce.dragOver(getBoard(), String(active.id), over ? String(over.id) : null),
      onDragEnd: ({ active, over }) =>
        announce.dragEnd(getBoard(), String(active.id), over ? String(over.id) : null),
      onDragCancel: ({ active }) => announce.dragCancel(getBoard(), String(active.id)),
    }),
    [getBoard],
  );

  return {
    activeId,
    overStatus,
    announcements,
    handlers: { onDragStart, onDragOver, onDragEnd, onDragCancel },
  };
}
