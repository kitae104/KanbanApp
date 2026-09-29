"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * 마운트되면 네이티브 <dialog>를 모달로 열고, 언마운트되면 닫은 뒤
 * 다이얼로그를 연 요소로 포커스를 돌려준다. Esc 등으로 닫히면 onClose를 부른다.
 */
export function useModalDialog(ref: RefObject<HTMLDialogElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();

    // close 이벤트는 비동기로 도착한다. 개발 모드 StrictMode는 이펙트를 정리 후 다시 실행하므로
    // 정리 때의 close()가 만든 이벤트가 다시 연 뒤에 도착할 수 있다. 열려 있으면 지난 이벤트로 보고 무시한다.
    const handleClose = () => {
      if (!dialog.open) onCloseRef.current();
    };
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
      // 트리거가 사라졌으면(예: 삭제된 카드) 보드 제목으로 포커스를 옮긴다.
      const fallback = document.getElementById("board-title");
      (trigger?.isConnected ? trigger : fallback)?.focus();
    };
  }, [ref]);
}
