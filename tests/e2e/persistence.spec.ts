import { expect, logIn, test } from "./fixtures";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { addCard, card, column, drag, openWith, storedTitles, titlesIn } from "./helpers";

test.describe("서버 저장과 저장 실패 (T-028)", () => {
  test("생성·수정·삭제·이동 후 새로고침해도 같은 상태다", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["지울 카드", "고칠 카드", "옮길 카드"] }));

    await addCard(page, "새 카드", "첫 줄\n둘째 줄");
    await page.getByRole("button", { name: "'고칠 카드' 수정" }).click();
    await page.getByRole("dialog").getByLabel(/제목/).fill("고친 카드");
    await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
    await page.getByRole("button", { name: "'지울 카드' 삭제" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
    await drag(page, card(page, "옮길 카드"), column(page, "DONE"));
    await expect(card(page, "옮길 카드")).toHaveAttribute("data-status", "DONE");

    const expected = { TODO: ["고친 카드", "새 카드"], DONE: ["옮길 카드"] };
    expect({ TODO: await titlesIn(page, "TODO"), DONE: await titlesIn(page, "DONE") }).toEqual(
      expected,
    );
    // 저장은 비동기다. 서버에 확정될 때까지 기다린 뒤 새로고침한다.
    await expect.poll(() => storedTitles(page, "DONE")).toEqual(expected.DONE);
    await expect.poll(() => storedTitles(page, "TODO")).toEqual(expected.TODO);

    await page.reload();
    await expect(card(page, "옮길 카드")).toHaveAttribute("data-status", "DONE");
    expect(await titlesIn(page, "TODO")).toEqual(expected.TODO);
    expect(await titlesIn(page, "DONE")).toEqual(expected.DONE);
    expect(await titlesIn(page, "IN_PROGRESS")).toEqual([]);
    await expect(page.getByText("둘째 줄")).toBeVisible();
  });

  test("localStorage가 없는 다른 브라우저에서 로그인해도 같은 보드다 (SC-7)", async ({
    page,
    account,
    browser,
  }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A", "B"], DONE: ["C"] }));
    await drag(page, card(page, "B"), column(page, "DONE"), { where: "bottom" });
    await expect.poll(() => storedTitles(page, "DONE")).toEqual(["C", "B"]);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await logIn(otherPage, account);
    expect(await otherPage.evaluate(() => localStorage.length)).toBe(0);
    expect(await titlesIn(otherPage, "TODO")).toEqual(["A"]);
    expect(await titlesIn(otherPage, "DONE")).toEqual(["C", "B"]);
    await other.close();
  });

  test("서버 저장에 실패하면 이동을 되돌리고 알린다 (FR-22)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"], DONE: ["X"] }));
    await page.route("**/api/board/cards/**", (route) =>
      route.fulfill({ status: 500, json: { error: "server" } }),
    );

    await drag(page, card(page, "A"), column(page, "DONE"));
    await expect(page.getByRole("alert").filter({ hasText: "저장에 실패했습니다" })).toBeVisible();
    await expect(card(page, "A")).toHaveAttribute("data-status", "TODO");
    expect(await titlesIn(page, "DONE")).toEqual(["X"]);
    expect(await storedTitles(page, "DONE")).toEqual(["X"]);
  });

  test("세션이 만료되면 되돌리고 로그인 화면으로 보낸다 (FR-21)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"] }));
    await page.context().clearCookies();

    await drag(page, card(page, "A"), column(page, "DONE"));
    await expect(page).toHaveURL(/\/login$/);
  });
});
