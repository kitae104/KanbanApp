"use client";

import { DndContext, DragOverlay, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useState, useSyncExternalStore } from "react";
import { CardFormDialog } from "@/components/dialogs/CardFormDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { useBoard } from "@/hooks/useBoard";
import { useBoardDnd } from "@/hooks/useBoardDnd";
import { SCREEN_READER_INSTRUCTIONS } from "@/lib/board/a11y";
import { newCardId } from "@/lib/board/id";
import type { CardInput } from "@/lib/board/schema";
import { STATUSES } from "@/lib/board/types";
import { BoardSkeleton } from "./BoardSkeleton";
import { CardView } from "./CardView";
import { Column } from "./Column";
import {
  CardKeyboardSensor,
  CardMouseSensor,
  CardTouchSensor,
  boardCollisionDetection,
} from "./sensors";

type FormState = { mode: "create" } | { mode: "edit"; cardId: string } | null;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

export function Board() {
  const { board, isHydrated, commit, toast, dismissToast } = useBoard();
  const [form, setForm] = useState<FormState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { activeId, overStatus, announcements, handlers } = useBoardDnd();
  const reducedMotion = usePrefersReducedMotion();

  const sensors = useSensors(
    useSensor(CardMouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(CardKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const openCreate = useCallback(() => setForm({ mode: "create" }), []);
  const openEdit = useCallback((cardId: string) => setForm({ mode: "edit", cardId }), []);
  const closeForm = useCallback(() => setForm(null), []);
  const closeConfirm = useCallback(() => setDeleteId(null), []);

  const handleSubmit = (input: CardInput) => {
    const now = new Date().toISOString();
    if (form?.mode === "edit") {
      commit({ type: "UPDATE_CARD", id: form.cardId, ...input, now });
    } else {
      commit({ type: "ADD_CARD", id: newCardId(), ...input, now });
    }
  };

  const handleDelete = () => {
    if (deleteId) commit({ type: "DELETE_CARD", id: deleteId });
    setDeleteId(null);
  };

  const editingCard = form?.mode === "edit" ? board.cards[form.cardId] : undefined;
  const deletingCard = deleteId ? board.cards[deleteId] : undefined;
  const activeCard = activeId ? board.cards[activeId] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <h1 id="board-title" tabIndex={-1} className="text-2xl font-bold text-ink focus:outline-none">
        칸반 보드
      </h1>

      {!isHydrated ? (
        <BoardSkeleton />
      ) : (
        <DndContext
          id="kanban-board"
          sensors={sensors}
          collisionDetection={boardCollisionDetection}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: SCREEN_READER_INSTRUCTIONS },
          }}
          {...handlers}
        >
          {/* 드래그 중에는 스크롤 스냅을 꺼야 자동 스크롤이 제자리로 되돌려지지 않는다. */}
          <div
            className={`-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 ${
              activeId ? "" : "snap-x snap-mandatory"
            }`}
          >
            {STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                cardIds={board.columns[status]}
                cards={board.cards}
                isDropTarget={activeId !== null && overStatus === status}
                onAdd={status === "TODO" ? openCreate : undefined}
                onEdit={openEdit}
                onDelete={setDeleteId}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
            {activeCard ? <CardView card={activeCard} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {form && (form.mode === "create" || editingCard) && (
        <CardFormDialog
          mode={form.mode}
          initial={editingCard && { title: editingCard.title, description: editingCard.description }}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {deletingCard && (
        <ConfirmDialog
          cardTitle={deletingCard.title}
          onConfirm={handleDelete}
          onCancel={closeConfirm}
        />
      )}

      {/* 서버 HTML에는 토스트가 없으므로 hydration 이후에만 그린다. */}
      {isHydrated && <Toast toast={toast} onDismiss={dismissToast} />}
    </main>
  );
}
