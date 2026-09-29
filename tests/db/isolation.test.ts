import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { query } from "@/server/db/pool";
import { addCard, deleteCard, getBoard, moveCard, updateCard } from "@/server/board/queries";
import { cardRows, createUser, positionsAreContiguous } from "./helpers";

// 요구사항 2: 유저는 자기 보드의 아이템만 읽기·쓰기·삭제할 수 있다 (SC-5, SC-6).

async function twoUsersWithCards() {
  const [a, b] = [await createUser(), await createUser()];
  const aCard = randomUUID();
  await addCard(a.boardId, { id: aCard, title: "A의 비밀", description: "A만 보는 설명" });
  await addCard(a.boardId, { id: randomUUID(), title: "A의 둘째", description: "" });
  await addCard(b.boardId, { id: randomUUID(), title: "B의 카드", description: "" });
  return { a, b, aCard };
}

describe("유저 간 격리", () => {
  it("B의 보드로는 A의 카드를 수정·삭제·이동할 수 없고, A의 행은 그대로다", async () => {
    const { a, b, aCard } = await twoUsersWithCards();
    const before = await cardRows(a.boardId);

    expect(await updateCard(b.boardId, aCard, { title: "탈취", description: "" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await deleteCard(b.boardId, aCard)).toEqual({ ok: false, error: "not_found" });
    expect(await moveCard(b.boardId, aCard, "DONE", 0)).toEqual({ ok: false, error: "not_found" });

    expect(await cardRows(a.boardId)).toEqual(before);
  });

  it("B의 보드 조회에는 A의 카드가 하나도 없다", async () => {
    const { b, aCard } = await twoUsersWithCards();
    const board = await getBoard(b.boardId);
    expect(board.cards[aCard]).toBeUndefined();
    expect(Object.values(board.cards).map((card) => card.title)).toEqual(["B의 카드"]);
  });

  it("B가 이동해도 A의 카드 순서는 다시 계산되지 않는다", async () => {
    const { a, b } = await twoUsersWithCards();
    const before = await cardRows(a.boardId);
    const bCard = (await cardRows(b.boardId))[0].id;
    await moveCard(b.boardId, bCard, "DONE", 0);
    expect(await cardRows(a.boardId)).toEqual(before);
  });
});

describe("트랜잭션", () => {
  it("이동 중 오류가 나면 모든 position이 원래대로 돌아간다 (부분 반영 없음)", async () => {
    const { a } = await twoUsersWithCards();
    const before = await cardRows(a.boardId);
    const first = before[0].id;

    await expect(
      moveCard(a.boardId, first, "TODO", 1, {
        afterUpdate: async () => {
          throw new Error("강제 실패");
        },
      }),
    ).rejects.toThrow("강제 실패");
    expect(await cardRows(a.boardId)).toEqual(before);
  });
});

describe("동시성", () => {
  it("같은 보드에 이동 여러 건을 동시에 보내도 UNIQUE 위반 없이 position이 연속된다", async () => {
    const { a } = await twoUsersWithCards();
    for (let i = 0; i < 4; i++) {
      await addCard(a.boardId, { id: randomUUID(), title: `추가 ${i}`, description: "" });
    }
    const ids = (await cardRows(a.boardId)).map((row) => row.id);
    const targets = ["DONE", "IN_PROGRESS", "DONE", "TODO", "IN_PROGRESS"] as const;

    const results = await Promise.all(
      targets.map((status, i) => moveCard(a.boardId, ids[i], status, 0)),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    const rows = await cardRows(a.boardId);
    expect(rows).toHaveLength(ids.length);
    expect(positionsAreContiguous(rows)).toBe(true);
  });
});

describe("DB 제약", () => {
  const insert = (boardId: string, title: string, status = "TODO") =>
    query(
      "INSERT INTO cards (id, board_id, title, status, position) VALUES ($1, $2, $3, $4, 0)",
      [randomUUID(), boardId, title, status],
    );

  it.each([
    ["101자 제목", "가".repeat(101), "TODO"],
    ["공백 제목", "   ", "TODO"],
    ["잘못된 상태", "제목", "DOING"],
  ])("%s은 CHECK 위반(23514)이다", async (_, title, status) => {
    const { boardId } = await createUser();
    await expect(insert(boardId, title, status)).rejects.toMatchObject({ code: "23514" });
  });

  it("한 유저에게 보드를 두 개 만들 수 없다(23505)", async () => {
    const { userId } = await createUser();
    await expect(query("INSERT INTO boards (user_id) VALUES ($1)", [userId])).rejects.toMatchObject({
      code: "23505",
    });
  });
});
