import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addCard, getBoard, moveCard } from "@/server/board/queries";
import { cardRows, createUser, positionsAreContiguous } from "./helpers";

/** TODO에 카드를 n개 만들고 id를 순서대로 돌려준다. */
async function seed(boardId: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = randomUUID();
    await addCard(boardId, { id, title: `카드 ${i}`, description: "" });
    ids.push(id);
  }
  return ids;
}

describe("moveCard", () => {
  it("같은 컬럼 안에서 순서를 바꾼다", async () => {
    const { boardId } = await createUser();
    const [a, b, c] = await seed(boardId, 3);
    const result = await moveCard(boardId, c, "TODO", 0);
    expect(result.ok && result.value.columns.TODO).toEqual([c, a, b]);
    expect(positionsAreContiguous(await cardRows(boardId))).toBe(true);
  });

  it("다른 컬럼의 중간에 넣고, 상태가 바뀐 카드만 updatedAt이 바뀐다", async () => {
    const { boardId } = await createUser();
    const [a, b, c, d] = await seed(boardId, 4);
    await moveCard(boardId, a, "DONE", 0);
    await moveCard(boardId, b, "DONE", 1);
    const before = await getBoard(boardId);

    const result = await moveCard(boardId, c, "DONE", 1);
    if (!result.ok) throw new Error("move failed");
    expect(result.value.columns).toEqual({ TODO: [d], IN_PROGRESS: [], DONE: [a, c, b] });
    expect(result.value.cards[c].status).toBe("DONE");
    expect(result.value.cards[c].updatedAt).not.toBe(before.cards[c].updatedAt);
    expect(result.value.cards[b].updatedAt).toBe(before.cards[b].updatedAt);
    expect(positionsAreContiguous(await cardRows(boardId))).toBe(true);
  });

  it("빈 컬럼으로 옮길 수 있고, 범위를 넘는 toIndex는 끝으로 맞춘다", async () => {
    const { boardId } = await createUser();
    const [a, b] = await seed(boardId, 2);
    await moveCard(boardId, a, "IN_PROGRESS", 0);
    const result = await moveCard(boardId, b, "IN_PROGRESS", 99);
    expect(result.ok && result.value.columns.IN_PROGRESS).toEqual([a, b]);
  });

  it("위치가 그대로면 아무것도 바꾸지 않는다", async () => {
    const { boardId } = await createUser();
    const [a, b] = await seed(boardId, 2);
    const result = await moveCard(boardId, a, "TODO", 0);
    expect(result.ok && result.value.columns.TODO).toEqual([a, b]);
  });

  it("없는 카드는 not_found다", async () => {
    const { boardId } = await createUser();
    expect(await moveCard(boardId, randomUUID(), "DONE", 0)).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});
