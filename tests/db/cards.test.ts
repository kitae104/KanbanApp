import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addCard, deleteCard, getBoard, updateCard } from "@/server/board/queries";
import { cardRows, createUser, positionsAreContiguous } from "./helpers";

const add = (boardId: string, title: string, id: string = randomUUID()) =>
  addCard(boardId, { id, title, description: "" });

describe("getBoard", () => {
  it("빈 보드를 돌려준다", async () => {
    const user = await createUser();
    expect(await getBoard(user.boardId)).toEqual({
      cards: {},
      columns: { TODO: [], IN_PROGRESS: [], DONE: [] },
    });
  });

  it("자기 보드의 카드만 돌려준다", async () => {
    const [a, b] = [await createUser(), await createUser()];
    await add(a.boardId, "A의 카드");
    await add(b.boardId, "B의 카드");
    const board = await getBoard(a.boardId);
    expect(Object.values(board.cards).map((card) => card.title)).toEqual(["A의 카드"]);
  });
});

describe("addCard", () => {
  it("새 카드는 TODO 맨 아래에 들어간다", async () => {
    const user = await createUser();
    await add(user.boardId, "첫째");
    const result = await add(user.boardId, "둘째");
    expect(result).toMatchObject({ ok: true, value: { status: "TODO", order: 1, title: "둘째" } });
    expect((await getBoard(user.boardId)).columns.TODO).toHaveLength(2);
  });

  it("이미 있는 id면 not_found이고 기존 카드는 그대로다", async () => {
    const [a, b] = [await createUser(), await createUser()];
    const id = randomUUID();
    await add(a.boardId, "A의 카드", id);
    expect(await add(b.boardId, "가로채기", id)).toEqual({ ok: false, error: "not_found" });
    expect((await getBoard(a.boardId)).cards[id].title).toBe("A의 카드");
    expect((await getBoard(b.boardId)).columns.TODO).toEqual([]);
  });
});

describe("updateCard", () => {
  it("제목과 설명을 바꾸고 updated_at을 갱신한다", async () => {
    const user = await createUser();
    const created = await add(user.boardId, "원래");
    if (!created.ok) throw new Error("setup");
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await updateCard(user.boardId, created.value.id, {
      title: "바뀜",
      description: "설명",
    });
    expect(result).toMatchObject({ ok: true, value: { title: "바뀜", description: "설명" } });
    if (result.ok) expect(result.value.updatedAt > created.value.updatedAt).toBe(true);
  });

  it("없는 카드는 not_found다", async () => {
    const user = await createUser();
    const result = await updateCard(user.boardId, randomUUID(), { title: "x", description: "" });
    expect(result).toEqual({ ok: false, error: "not_found" });
  });
});

describe("deleteCard", () => {
  it("가운데 카드를 지우면 뒤쪽 카드가 당겨져 position이 연속된다", async () => {
    const user = await createUser();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [index, id] of ids.entries()) await add(user.boardId, `카드 ${index}`, id);

    expect(await deleteCard(user.boardId, ids[1])).toEqual({ ok: true, value: null });
    const rows = await cardRows(user.boardId);
    expect(rows.map((row) => row.id)).toEqual([ids[0], ids[2]]);
    expect(positionsAreContiguous(rows)).toBe(true);
  });

  it("없는 카드는 not_found다", async () => {
    const user = await createUser();
    expect(await deleteCard(user.boardId, randomUUID())).toEqual({ ok: false, error: "not_found" });
  });
});
