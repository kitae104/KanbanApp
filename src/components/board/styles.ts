import type { Status } from "@/lib/board/types";

/** Tailwind가 클래스를 찾을 수 있도록 상태별 클래스를 정적으로 둔다. */
export const STATUS_STYLES: Record<Status, { accent: string; badge: string }> = {
  TODO: { accent: "border-t-todo-accent", badge: "bg-todo-soft text-todo-ink" },
  IN_PROGRESS: { accent: "border-t-progress-accent", badge: "bg-progress-soft text-progress-ink" },
  DONE: { accent: "border-t-done-accent", badge: "bg-done-soft text-done-ink" },
};

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const BUTTON_BASE = `inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${FOCUS_RING}`;
