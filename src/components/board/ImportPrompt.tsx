"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useBoard } from "@/hooks/useBoard";
import type { StoredBoard } from "@/lib/board/schema";
import { STORAGE_VERSION } from "@/lib/board/schema";
import type { BoardState } from "@/lib/board/types";
import type { LocalBoardStore } from "@/lib/storage/boardRepository";
import { localStorageBoardRepository } from "@/lib/storage/localStorageBoardRepository";

/** 이번 탭에서 "취소"를 누르면 다시 묻지 않는다. */
export const IMPORT_DECLINED_KEY = "kanban-app:import-declined";

function isDeclined(): boolean {
  try {
    return sessionStorage.getItem(IMPORT_DECLINED_KEY) === "1";
  } catch {
    return false;
  }
}

function markDeclined() {
  try {
    sessionStorage.setItem(IMPORT_DECLINED_KEY, "1");
  } catch {
    // 저장하지 못하면 다음 새로고침 때 다시 물을 뿐이다.
  }
}

interface ImportPromptProps {
  store?: LocalBoardStore;
}

/**
 * 서버 보드가 비어 있고 이 브라우저에 로그인 전 보드가 남아 있으면 가져올지 묻는다 (FR-25).
 * localStorage는 브라우저에만 있으므로 마운트한 뒤에 확인한다(서버 HTML과 어긋나지 않게).
 */
export function ImportPrompt({ store = localStorageBoardRepository }: ImportPromptProps) {
  const { board, importBoard } = useBoard();
  const [local, setLocal] = useState<BoardState | null>(null);
  const [busy, setBusy] = useState(false);
  const isEmpty = Object.keys(board.cards).length === 0;

  useEffect(() => {
    if (!isEmpty || isDeclined()) return;
    const result = store.load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장소는 마운트 후에만 읽을 수 있다.
    if (result.ok && Object.keys(result.board.cards).length > 0) setLocal(result.board);
    // 처음 마운트할 때 한 번만 확인한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!local) return null;
  const count = Object.keys(local.cards).length;

  const close = () => setLocal(null);
  const cancel = () => {
    markDeclined();
    close();
  };
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const stored: StoredBoard = {
      version: STORAGE_VERSION,
      savedAt: new Date().toISOString(),
      board: local,
    };
    const ok = await importBoard(stored);
    setBusy(false);
    if (ok) store.archive();
    close();
  };

  return (
    <ConfirmDialog
      heading="저장된 카드 가져오기"
      message={`이 브라우저에 저장된 카드 ${count}개를 내 보드로 가져올까요?`}
      confirmLabel={busy ? "가져오는 중…" : "가져오기"}
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
}
