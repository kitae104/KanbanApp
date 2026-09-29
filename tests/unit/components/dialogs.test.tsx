import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CardFormDialog } from "@/components/dialogs/CardFormDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";

/** 비동기로 도착하는 close 이벤트까지 처리되게 기다린다. */
const flushCloseEvents = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

describe("다이얼로그 (개발 모드 StrictMode)", () => {
  it("카드 추가 다이얼로그가 열린 채로 남는다", async () => {
    const onClose = vi.fn();
    render(
      <StrictMode>
        <CardFormDialog mode="create" onSubmit={() => {}} onClose={onClose} />
      </StrictMode>,
    );
    await flushCloseEvents();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "카드 추가" })).toHaveAttribute("open");
  });

  it("삭제 확인 다이얼로그가 열린 채로 남는다", async () => {
    const onCancel = vi.fn();
    render(
      <StrictMode>
        <ConfirmDialog
          heading="카드 삭제"
          message="삭제할까요?"
          confirmLabel="삭제"
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      </StrictMode>,
    );
    await flushCloseEvents();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveAttribute("open");
  });

  it("실제로 닫히면(Esc 등) onClose를 부른다", async () => {
    const onClose = vi.fn();
    render(<CardFormDialog mode="create" onSubmit={() => {}} onClose={onClose} />);
    act(() => screen.getByRole("dialog").closest("dialog")!.close());
    await flushCloseEvents();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
