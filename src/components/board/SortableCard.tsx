"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import { CARD_ROLE_DESCRIPTION } from "@/lib/board/a11y";
import type { Card } from "@/lib/board/types";
import { CardView } from "./CardView";
import { FOCUS_RING } from "./styles";

interface SortableCardProps {
  card: Card;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const SortableCard = memo(function SortableCard({
  card,
  onEdit,
  onDelete,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    // 카드 안에 수정·삭제 버튼이 있으므로 button 역할 대신 group을 쓴다(중첩 인터랙티브 방지).
    attributes: { role: "group", roleDescription: CARD_ROLE_DESCRIPTION },
  });

  return (
    <li>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        aria-label={card.title}
        data-testid={`card-${card.id}`}
        data-status={card.status}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`cursor-grab touch-manipulation rounded-lg ${FOCUS_RING} ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        <CardView card={card} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  );
});
