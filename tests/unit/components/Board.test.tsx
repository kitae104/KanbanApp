import { DndContext } from "@dnd-kit/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Board } from "@/components/board/Board";
import { BoardProvider, MESSAGES } from "@/components/board/BoardProvider";
import { Column } from "@/components/board/Column";
import { createEmptyBoard } from "@/lib/board/operations";
import type { BoardState } from "@/lib/board/types";
import {
  createMemoryBoardRepository,
  type MemoryBoardRepository,
} from "@/lib/storage/memoryBoardRepository";
import { makeBoard } from "../board/helpers";

let seeded: BoardState;
let repo: MemoryBoardRepository;

/** 서버에 이 보드가 저장되어 있는 상태로 시작한다. */
function seed(layout: Parameters<typeof makeBoard>[0]) {
  seeded = makeBoard(layout);
  return seeded;
}

function renderBoard() {
  const user = userEvent.setup();
  repo = createMemoryBoardRepository(seeded);
  render(
    <BoardProvider initialBoard={seeded} repository={repo} onUnauthorized={() => {}}>
      <Board />
    </BoardProvider>,
  );
  return user;
}

const column = (status: string) => screen.getByTestId(`column-${status}`);
const count = (status: string) => screen.getByTestId(`column-count-${status}`);
/** 서버(메모리 저장소)에 확정된 할 일 컬럼. */
const storedTodo = () => repo.board.columns.TODO;

beforeEach(() => {
  seeded = createEmptyBoard();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("보드·컬럼 (T-016)", () => {
  it("3개 컬럼을 할 일, 진행 중, 완료 순서로 보여준다 (SC-1)", () => {
    renderBoard();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["할 일", "진행 중", "완료"]);
  });

  it("컬럼 헤더에 카드 수를 표시한다 (FR-3)", () => {
    seed({ TODO: ["a", "b"], DONE: ["c"] });
    renderBoard();
    expect(count("TODO")).toHaveTextContent("카드 2개");
    expect(count("IN_PROGRESS")).toHaveTextContent("카드 0개");
    expect(count("DONE")).toHaveTextContent("카드 1개");
  });

  it("카드 추가 버튼은 할 일 컬럼에만 있다", () => {
    renderBoard();
    expect(within(column("TODO")).getByRole("button", { name: "+ 카드 추가" })).toBeInTheDocument();
    expect(within(column("DONE")).queryByRole("button", { name: "+ 카드 추가" })).toBeNull();
  });

  it("드롭 대상 컬럼을 강조한다 (T-022)", () => {
    const props = { cardIds: [], cards: {}, onEdit: () => {}, onDelete: () => {} };
    render(
      <DndContext>
        <Column status="TODO" isDropTarget {...props} />
        <Column status="DONE" isDropTarget={false} {...props} />
      </DndContext>,
    );
    expect(column("TODO")).toHaveClass("ring-2");
    expect(column("DONE")).not.toHaveClass("ring-2");
  });
});

describe("카드 표시 (T-017)", () => {
  it("HTML 문자열을 그대로 텍스트로 보여준다 (NFR-9)", async () => {
    const user = renderBoard();
    await user.click(screen.getByRole("button", { name: "+ 카드 추가" }));
    await user.type(screen.getByLabelText(/제목/), "<script>alert(1)</script>");
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(within(column("TODO")).getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("main script")).toBeNull();
  });

  it("설명의 줄바꿈을 유지한다", () => {
    const board = makeBoard({ TODO: ["a"] });
    board.cards.a.description = "첫째 줄\n둘째 줄";
    seeded = board;
    renderBoard();
    const description = screen.getByText(/첫째 줄/);
    expect(description.textContent).toBe("첫째 줄\n둘째 줄");
    expect(description).toHaveClass("whitespace-pre-wrap");
  });

  it("카드에 상태와 드래그 역할 설명을 붙인다", () => {
    seed({ IN_PROGRESS: ["a"] });
    renderBoard();
    const card = screen.getByTestId("card-a");
    expect(card).toHaveAttribute("data-status", "IN_PROGRESS");
    expect(card).toHaveAttribute("aria-roledescription", "이동 가능한 카드");
  });
});

describe("카드 생성·수정 (T-018)", () => {
  it("제목을 입력하면 할 일 맨 아래에 추가되고 카드 수가 1 늘어난다 (SC-2)", async () => {
    seed({ TODO: ["a"] });
    const user = renderBoard();
    await user.click(screen.getByRole("button", { name: "+ 카드 추가" }));
    await user.type(screen.getByLabelText(/제목/), "  새 작업  ");
    await user.type(screen.getByLabelText(/설명/), "메모");
    await user.click(screen.getByRole("button", { name: "추가" }));

    const titles = within(column("TODO"))
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(["카드 a", "새 작업"]);
    expect(count("TODO")).toHaveTextContent("카드 2개");
    await waitFor(() => expect(storedTodo()).toHaveLength(2));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each([
    ["빈 제목", ""],
    ["공백만 있는 제목", "   "],
  ])("%s이면 오류를 보여주고 만들지 않는다 (SC-8)", async (_, title) => {
    const user = renderBoard();
    await user.click(screen.getByRole("button", { name: "+ 카드 추가" }));
    if (title) await user.type(screen.getByLabelText(/제목/), title);
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("제목을 입력하세요.")).toBeInTheDocument();
    expect(screen.getByLabelText(/제목/)).toHaveAttribute("aria-invalid", "true");
    expect(count("TODO")).toHaveTextContent("카드 0개");
    expect(repo.calls).toEqual([]);
  });

  it("수정하면 기존 값이 채워져 있고 저장 후 반영된다 (FR-7)", async () => {
    seed({ DONE: ["a"] });
    const user = renderBoard();
    await user.click(screen.getByRole("button", { name: "'카드 a' 수정" }));
    const title = screen.getByLabelText(/제목/);
    expect(title).toHaveValue("카드 a");
    await user.clear(title);
    await user.type(title, "고친 제목");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(within(column("DONE")).getByText("고친 제목")).toBeInTheDocument();
    expect(screen.getByTestId("card-a")).toHaveAttribute("data-status", "DONE");
  });

  it("취소하면 아무것도 바뀌지 않는다", async () => {
    const user = renderBoard();
    await user.click(screen.getByRole("button", { name: "+ 카드 추가" }));
    await user.type(screen.getByLabelText(/제목/), "안 만들 카드");
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText("안 만들 카드")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("저장에 실패하면 추가를 되돌리고 알린다 (FR-18)", async () => {
    const user = renderBoard();
    repo.failNext("server");
    await user.click(screen.getByRole("button", { name: "+ 카드 추가" }));
    await user.type(screen.getByLabelText(/제목/), "저장 안 될 카드");
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGES.saveFailed);
    expect(screen.queryByText("저장 안 될 카드")).toBeNull();
    expect(storedTodo()).toEqual([]);
  });
});

describe("삭제 확인 (T-019)", () => {
  it("취소하면 카드가 남는다", async () => {
    seed({ TODO: ["a"] });
    const user = renderBoard();
    await user.click(screen.getByRole("button", { name: "'카드 a' 삭제" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("‘카드 a’ 카드를 삭제할까요?");
    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.getByTestId("card-a")).toBeInTheDocument();
    expect(count("TODO")).toHaveTextContent("카드 1개");
  });

  it("확인하면 카드를 지우고 카드 수가 1 줄어든다 (FR-8)", async () => {
    seed({ TODO: ["a", "b"] });
    const user = renderBoard();
    await user.click(screen.getByRole("button", { name: "'카드 a' 삭제" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "삭제" }));
    expect(screen.queryByTestId("card-a")).toBeNull();
    expect(count("TODO")).toHaveTextContent("카드 1개");
    await waitFor(() => expect(storedTodo()).toEqual(["b"]));
  });
});
