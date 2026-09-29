import { BUTTON_BASE } from "./styles";

export function AddCardButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${BUTTON_BASE} w-full border border-dashed border-line py-2 text-muted hover:bg-surface hover:text-ink`}
    >
      + 카드 추가
    </button>
  );
}
