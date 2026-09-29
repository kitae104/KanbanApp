import { memo } from "react";
import type { Card } from "@/lib/board/types";
import { BUTTON_BASE } from "./styles";

interface CardViewProps {
  card: Card;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** DragOverlay에 띄운 복제본이면 true. 버튼을 숨기고 그림자를 키운다. */
  isOverlay?: boolean;
}

/** 카드 표시 전용 컴포넌트. 사용자 입력은 텍스트 노드로만 출력한다 (NFR-9). */
export const CardView = memo(function CardView({
  card,
  onEdit,
  onDelete,
  isOverlay = false,
}: CardViewProps) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface p-3 ${
        isOverlay ? "cursor-grabbing shadow-xl" : "shadow-sm"
      }`}
    >
      <h3 className="font-semibold break-words text-ink">{card.title}</h3>
      {card.description && (
        <p className="mt-1 text-sm break-words whitespace-pre-wrap text-muted">
          {card.description}
        </p>
      )}
      {!isOverlay && (
        <div className="mt-2 flex justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit?.(card.id)}
            aria-label={`'${card.title}' 수정`}
            className={`${BUTTON_BASE} text-muted hover:bg-column hover:text-ink`}
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(card.id)}
            aria-label={`'${card.title}' 삭제`}
            className={`${BUTTON_BASE} text-danger hover:bg-column`}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
});
