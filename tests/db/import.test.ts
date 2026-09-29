import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addCard, getBoard, importBoard } from "@/server/board/queries";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { cardRows, createUser, positionsAreContiguous } from "./helpers";

const titles = (board: Awaited<ReturnType<typeof getBoard>>, status: keyof typeof board.columns) =>
  board.columns[status].map((id) => board.cards[id].title);

describe("importBoard", () => {
  it("컬럼별 카드 수, 순서, 제목을 유지하고 id는 새로 발급한다", async () => {
    const { boardId } = await createUser();
    const stored = buildStoredBoard({ TODO: ["가", "나"], IN_PROGRESS: ["다"], DONE: ["라", "마", "바"] });

    const result = await importBoard(boardId, stored);
    if (!result.ok) throw new Error(result.error);

    const board = await getBoard(boardId);
    expect(titles(board, "TODO")).toEqual(["가", "나"]);
    expect(titles(board, "IN_PROGRESS")).toEqual(["다"]);
    expect(titles(board, "DONE")).toEqual(["라", "마", "바"]);
    expect(Object.keys(board.cards)).not.toContain("todo-0");
    expect(board.cards[board.columns.TODO[0]].createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(positionsAreContiguous(await cardRows(boardId))).toBe(true);
  });

  it("카드가 이미 있으면 conflict이고 기존 카드는 그대로다", async () => {
    const { boardId } = await createUser();
    await addCard(boardId, { id: randomUUID(), title: "기존", description: "" });
    expect(await importBoard(boardId, buildStoredBoard({ TODO: ["새"] }))).toEqual({
      ok: false,
      error: "conflict",
    });
    expect(titles(await getBoard(boardId), "TODO")).toEqual(["기존"]);
  });

  it("형식이 맞지 않으면 invalid다", async () => {
    const { boardId } = await createUser();
    expect(await importBoard(boardId, { version: 1, board: "x" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
