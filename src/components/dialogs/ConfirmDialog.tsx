"use client";

import { useId, useRef } from "react";
import { BUTTON_BASE } from "@/components/board/styles";
import { useModalDialog } from "@/hooks/useModalDialog";

interface ConfirmDialogProps {
  cardTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 카드 삭제 확인 (FR-8). 첫 포커스는 "취소" 버튼이고 Esc도 취소로 처리한다. */
export function ConfirmDialog({ cardTitle, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  useModalDialog(dialogRef, onCancel);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-body`}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 id={`${id}-heading`} className="text-lg font-bold">
          카드 삭제
        </h2>
        <p id={`${id}-body`} className="break-words text-muted">
          &lsquo;{cardTitle}&rsquo; 카드를 삭제할까요? 삭제한 카드는 되돌릴 수 없습니다.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`${BUTTON_BASE} text-muted hover:bg-column hover:text-ink`}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${BUTTON_BASE} bg-danger text-white hover:bg-danger-strong`}
          >
            삭제
          </button>
        </div>
      </div>
    </dialog>
  );
}
