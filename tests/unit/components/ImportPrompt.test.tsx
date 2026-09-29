import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { BoardProvider } from "@/components/board/BoardProvider";
import { IMPORT_DECLINED_KEY, ImportPrompt } from "@/components/board/ImportPrompt";
import { createEmptyBoard } from "@/lib/board/operations";
import type { BoardState } from "@/lib/board/types";
import {
  IMPORTED_PREFIX,
  STORAGE_KEY,
  createLocalStorageBoardRepository,
} from "@/lib/storage/localStorageBoardRepository";
import {
  createMemoryBoardRepository,
  type MemoryBoardRepository,
} from "@/lib/storage/memoryBoardRepository";
import { makeBoard } from "../board/helpers";

let repo: MemoryBoardRepository;

function saveLocal(board: BoardState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, savedAt: "2026-01-01T00:00:00.000Z", board }),
  );
}

function renderPrompt(initial = createEmptyBoard()) {
  repo = createMemoryBoardRepository(initial);
  render(
    <BoardProvider initialBoard={initial} repository={repo} onUnauthorized={() => {}}>
      <ImportPrompt store={createLocalStorageBoardRepository()} />
    </BoardProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("ImportPrompt (FR-25)", () => {
  it("서버 보드가 비어 있고 로컬에 카드가 있으면 개수와 함께 묻는다", async () => {
    saveLocal(makeBoard({ TODO: ["a", "b"], DONE: ["c"] }));
    renderPrompt();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("카드 3개를 내 보드로 가져올까요?");
  });

  it("서버 보드에 카드가 있거나 로컬이 비어 있으면 묻지 않는다", () => {
    saveLocal(makeBoard({ TODO: ["a"] }));
    renderPrompt(makeBoard({ DONE: ["z"] }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("로컬 저장 데이터가 없으면 묻지 않는다", () => {
    renderPrompt();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("가져오면 서버 보드가 채워지고 원본은 백업 키로 옮겨진다", async () => {
    saveLocal(makeBoard({ TODO: ["a"], IN_PROGRESS: ["b"] }));
    const user = renderPrompt();
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "가져오기" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(repo.board.columns).toMatchObject({ TODO: ["a"], IN_PROGRESS: ["b"] });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(Object.keys(localStorage).some((key) => key.startsWith(IMPORTED_PREFIX))).toBe(true);
  });

  // 실패 토스트 문구(MESSAGES.importFailed)는 BoardProvider 테스트에서 확인한다.
  it("가져오기에 실패하면 원본을 그대로 남긴다", async () => {
    saveLocal(makeBoard({ TODO: ["a"] }));
    const user = renderPrompt();
    repo.failNext("server");
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "가져오기" }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(repo.board.columns.TODO).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("취소하면 이 탭에서는 다시 묻지 않는다", async () => {
    saveLocal(makeBoard({ TODO: ["a"] }));
    const user = renderPrompt();
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "취소" }));
    expect(sessionStorage.getItem(IMPORT_DECLINED_KEY)).toBe("1");
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});
