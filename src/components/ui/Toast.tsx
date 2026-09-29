"use client";

import { useEffect } from "react";
import type { ToastMessage } from "@/components/board/BoardProvider";

const AUTO_DISMISS_MS = 5000;

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg bg-toast px-4 py-3 text-sm text-toast-ink shadow-lg"
    >
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded px-1 font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-toast-ink"
      >
        닫기
      </button>
    </div>
  );
}
