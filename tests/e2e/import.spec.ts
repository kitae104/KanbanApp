import { expect, logIn, newAccount, signUp, test } from "./fixtures";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { STORAGE_KEY, titlesIn } from "./helpers";

test.describe("로그인 전 데이터 가져오기 (T-031, FR-25)", () => {
  test.use({ loggedIn: false });

  test("이 브라우저의 기존 보드를 내 보드로 가져오고, 다른 기기에서도 보인다", async ({
    page,
    browser,
  }) => {
    const stored = buildStoredBoard({ TODO: ["가", "나"], IN_PROGRESS: ["다"], DONE: ["라"] });
    await page.goto("/login");
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(stored)] as const,
    );

    const account = newAccount();
    await signUp(page, account);
    const dialog = page.getByRole("alertdialog", { name: "저장된 카드 가져오기" });
    await expect(dialog).toContainText("카드 4개");
    await dialog.getByRole("button", { name: "가져오기" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "가져왔습니다" })).toBeVisible();
    expect(await titlesIn(page, "TODO")).toEqual(["가", "나"]);
    expect(await titlesIn(page, "IN_PROGRESS")).toEqual(["다"]);
    expect(await titlesIn(page, "DONE")).toEqual(["라"]);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();

    const other = await (await browser.newContext()).newPage();
    await logIn(other, account);
    expect(await titlesIn(other, "TODO")).toEqual(["가", "나"]);
    expect(await titlesIn(other, "DONE")).toEqual(["라"]);
  });

  test("취소하면 가져오지 않고 원본을 남긴다", async ({ page }) => {
    const stored = buildStoredBoard({ TODO: ["가"] });
    await page.goto("/login");
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(stored)] as const,
    );
    await signUp(page, newAccount());
    await page.getByRole("alertdialog").getByRole("button", { name: "취소" }).click();
    await expect(page.getByTestId("column-count-TODO")).toHaveText(/카드 0개/);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).not.toBeNull();

    await page.reload();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });
});
