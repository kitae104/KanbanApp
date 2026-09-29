import { expect, test } from "@playwright/test";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { STORAGE_KEY, addCard, card, column, drag, openWith, titlesIn } from "./helpers";

test.describe("새로고침 복원과 저장 실패 (T-028)", () => {
  test("생성·수정·삭제·이동 후 새로고침해도 같은 상태다 (SC-6)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["지울 카드", "고칠 카드", "옮길 카드"] }));

    await addCard(page, "새 카드", "첫 줄\n둘째 줄");
    await page.getByRole("button", { name: "'고칠 카드' 수정" }).click();
    await page.getByRole("dialog").getByLabel(/제목/).fill("고친 카드");
    await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
    await page.getByRole("button", { name: "'지울 카드' 삭제" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
    await drag(page, card(page, "옮길 카드"), column(page, "DONE"));
    await expect(card(page, "옮길 카드")).toHaveAttribute("data-status", "DONE");

    const before = {
      TODO: await titlesIn(page, "TODO"),
      DONE: await titlesIn(page, "DONE"),
    };
    expect(before).toEqual({ TODO: ["고친 카드", "새 카드"], DONE: ["옮길 카드"] });

    await page.reload();
    await expect(card(page, "옮길 카드")).toHaveAttribute("data-status", "DONE");
    expect(await titlesIn(page, "TODO")).toEqual(before.TODO);
    expect(await titlesIn(page, "DONE")).toEqual(before.DONE);
    expect(await titlesIn(page, "IN_PROGRESS")).toEqual([]);
    await expect(page.getByText("둘째 줄")).toBeVisible();
  });

  test("저장에 실패하면 이동을 되돌리고 알린다 (FR-18)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"], DONE: ["X"] }));
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      };
    });

    await drag(page, card(page, "A"), column(page, "DONE"));
    await expect(page.getByRole("alert").filter({ hasText: "저장에 실패했습니다" })).toBeVisible();
    await expect(card(page, "A")).toHaveAttribute("data-status", "TODO");
    expect(await titlesIn(page, "DONE")).toEqual(["X"]);
  });

  test("손상된 저장 데이터면 빈 보드로 시작하고 안내한다", async ({ page }) => {
    await page.goto("/");
    await page.evaluate((key) => localStorage.setItem(key, "{broken"), STORAGE_KEY);
    await page.reload();
    await expect(page.getByRole("alert").filter({ hasText: "빈 보드로 시작합니다" })).toBeVisible();
    await expect(page.getByTestId("column-count-TODO")).toHaveText(/카드 0개/);
    const backups = await page.evaluate(
      (key) => Object.keys(localStorage).filter((k) => k.startsWith(`${key}:corrupt-`)),
      STORAGE_KEY,
    );
    expect(backups).toHaveLength(1);
  });
});
