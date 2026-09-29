import { expect, test } from "@playwright/test";

test("페이지가 한국어 문서로 열린다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
});
