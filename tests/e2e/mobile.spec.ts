import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { card, column, openWith, titlesIn } from "./helpers";

type Point = { x: number; y: number };

/**
 * CDP로 길게 누른 뒤(TouchSensor 지연 200ms) 끌어서 놓는 터치 드래그. Chromium 전용.
 * holdMs만큼 마지막 지점에 머물며 자동 스크롤을 기다린다.
 */
async function touchDrag(page: Page, start: Point, end: Point, holdMs = 0) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove", { x, y }: Point) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [{ x, y, id: 1 }] });

  await touch("touchStart", start);
  await page.waitForTimeout(350);
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", {
      x: start.x + ((end.x - start.x) * i) / steps,
      y: start.y + ((end.y - start.y) * i) / steps,
    });
  }
  for (let waited = 0; waited < holdMs; waited += 50) {
    await page.waitForTimeout(50);
    await touch("touchMove", { x: end.x, y: end.y + (waited % 100 ? 1 : 0) });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function center(page: Page, title: string) {
  const box = (await card(page, title).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("모바일 (T-030)", () => {
  test("페이지는 가로로 넘치지 않고 컬럼 영역만 가로 스크롤된다 (NFR-8)", async ({ page }) => {
    await page.goto("/");
    await expect(column(page, "TODO")).toBeVisible();
    const overflow = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="column-TODO"]')!.parentElement!;
      return {
        page: document.documentElement.scrollWidth - window.innerWidth,
        board: row.scrollWidth - row.clientWidth,
      };
    });
    expect(overflow.page).toBeLessThanOrEqual(0);
    expect(overflow.board).toBeGreaterThan(0);
  });

  test("길게 눌러 터치로 같은 컬럼 안 순서를 바꾼다 (FR-9)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["첫째", "둘째"] }));
    const second = (await card(page, "둘째").boundingBox())!;
    await touchDrag(page, await center(page, "첫째"), {
      x: second.x + second.width / 2,
      y: second.y + second.height - 5,
    });
    await expect.poll(() => titlesIn(page, "TODO")).toEqual(["둘째", "첫째"]);
  });

  test("화면 끝으로 끌면 옆 컬럼으로 스크롤되어 옮길 수 있다 (FR-9)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["터치 카드"] }));
    const viewport = page.viewportSize()!;
    const start = await center(page, "터치 카드");
    await touchDrag(page, start, { x: viewport.width - 4, y: start.y + 60 }, 1500);
    await expect(card(page, "터치 카드")).not.toHaveAttribute("data-status", "TODO");
  });

  test("짧게 탭하면 드래그가 아니라 버튼이 동작한다", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"] }));
    await page.getByRole("button", { name: "'A' 수정" }).tap();
    await expect(page.getByRole("dialog", { name: "카드 수정" })).toBeVisible();
  });
});
