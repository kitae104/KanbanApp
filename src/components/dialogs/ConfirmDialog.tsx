"use client";

import { useId, useRef, type ReactNode } from "react";
import { BUTTON_BASE } from "@/components/board/styles";
import { useModalDialog } from "@/hooks/useModalDialog";

interface ConfirmDialogProps {
  heading: string;
  message: ReactNode;
  confirmLabel: string;
  /** 되돌릴 수 없는 작업이면 확인 버튼을 위험 색으로 칠한다. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 확인 대화상자. 카드 삭제(FR-8)와 로컬 데이터 가져오기(FR-25)에 쓴다.
 * 첫 포커스는 "취소" 버튼이고 Esc도 취소로 처리한다.
 */
export function ConfirmDialog({
  heading,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
          {heading}
        </h2>
        <p id={`${id}-body`} className="break-words text-muted">
          {message}
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
            className={`${BUTTON_BASE} text-white ${
              destructive ? "bg-danger hover:bg-danger-strong" : "bg-primary hover:bg-primary-strong"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
