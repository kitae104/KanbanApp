import { randomUUID } from "node:crypto";
import { expect, newAccount, signUp, test } from "./fixtures";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { openWith, readBoard, sameOrigin, titlesIn } from "./helpers";

// 요구사항 2: 유저는 자기 보드의 아이템만 읽기·쓰기·삭제할 수 있다 (SC-5, SC-6).

test.describe("다른 유저의 아이템 (T-030)", () => {
  test("B는 A의 카드를 조회·수정·삭제·이동할 수 없고, A의 보드는 그대로다", async ({
    page: pageA,
    browser,
  }) => {
    await openWith(pageA, buildStoredBoard({ TODO: ["A의 비밀"], DONE: ["A의 완료"] }));
    const boardA = await readBoard(pageA);
    const aCard = boardA.columns.TODO[0];

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(pageB, newAccount());
    const headers = sameOrigin(pageB);

    const attempts = [
      await pageB.request.patch(`/api/board/cards/${aCard}`, {
        data: { title: "탈취", description: "" },
        headers,
      }),
      await pageB.request.post(`/api/board/cards/${aCard}/move`, {
        data: { toStatus: "DONE", toIndex: 0 },
        headers,
      }),
      await pageB.request.delete(`/api/board/cards/${aCard}`, { headers }),
    ];
    for (const response of attempts) {
      expect(response.status()).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    }

    // 없는 카드와 응답이 같다. 다른 유저 카드의 존재 여부가 드러나지 않는다.
    const missing = await pageB.request.delete(`/api/board/cards/${randomUUID()}`, { headers });
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });

    const boardB = await readBoard(pageB);
    expect(boardB.cards[aCard]).toBeUndefined();
    expect(Object.keys(boardB.cards)).toEqual([]);

    await pageA.reload();
    expect(await titlesIn(pageA, "TODO")).toEqual(["A의 비밀"]);
    expect(await titlesIn(pageA, "DONE")).toEqual(["A의 완료"]);
    expect(await readBoard(pageA)).toEqual(boardA);
    await contextB.close();
  });

  test("요청에 다른 유저의 boardId·userId를 넣어도 내 보드에만 생성된다", async ({
    page: pageA,
    browser,
  }) => {
    await pageA.goto("/");
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signUp(pageB, newAccount());

    const response = await pageB.request.post("/api/board/cards", {
      data: {
        id: randomUUID(),
        title: "끼워넣기",
        description: "",
        boardId: randomUUID(),
        userId: randomUUID(),
      },
      headers: sameOrigin(pageB),
    });
    expect(response.status()).toBe(201);
    expect(Object.keys((await readBoard(pageA)).cards)).toEqual([]);
    expect(Object.values((await readBoard(pageB)).cards).map((card) => card.title)).toEqual([
      "끼워넣기",
    ]);
    await contextB.close();
  });
});
