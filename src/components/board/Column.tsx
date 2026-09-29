"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { STATUS_LABEL, type Card, type Status } from "@/lib/board/types";
import { AddCardButton } from "./AddCardButton";
import { SortableCard } from "./SortableCard";
import { STATUS_STYLES } from "./styles";

interface ColumnProps {
  status: Status;
  cardIds: string[];
  cards: Record<string, Card>;
  /** 드래그 중인 카드가 들어갈 컬럼이면 true (FR-13). */
  isDropTarget: boolean;
  onAdd?: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function Column({
  status,
  cardIds,
  cards,
  isDropTarget,
  onAdd,
  onEdit,
  onDelete,
}: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: status });
  const headingId = `column-heading-${status}`;
  const styles = STATUS_STYLES[status];

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-testid={`column-${status}`}
      className={`flex h-[calc(100dvh-10rem-1px)] min-h-80 w-[85vw] shrink-0 snap-start flex-col rounded-xl border-t-4 bg-column sm:w-80 lg:w-auto ${
        styles.accent
      } ${isDropTarget ? "ring-2 ring-primary" : ""}`}
    >
      <header className="flex items-center justify-between px-3 pt-3 pb-2">
        <h2 id={headingId} className="font-bold text-ink">
          {STATUS_LABEL[status]}
        </h2>
        <span
          data-testid={`column-count-${status}`}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}
        >
          <span aria-hidden="true">{cardIds.length}</span>
          <span className="sr-only">카드 {cardIds.length}개</span>
        </span>
      </header>

      <SortableContext id={status} items={cardIds} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {cardIds.map((id) => (
            <SortableCard key={id} card={cards[id]} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      </SortableContext>

      {onAdd && (
        <div className="px-3 pb-3">
          <AddCardButton onClick={onAdd} />
        </div>
      )}
    </section>
  );
}
