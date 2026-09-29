import { expect, test } from "@playwright/test";
import { buildLargeBoard } from "../fixtures/seedBoard";
import { STORAGE_KEY, card, column } from "./helpers";

test.describe("성능 (T-030, SC-9)", () => {
  test.beforeEach(async ({ page }) => {
    const stored = JSON.stringify(buildLargeBoard(200));
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem(key, value);
          sessionStorage.setItem("seeded", "1");
        }
      },
      [STORAGE_KEY, stored] as const,
    );
  });

  test("카드 600장에서 2초 안에 보드가 보인다", async ({ page }) => {
    const started = Date.now();
    await page.goto("/");
    await expect(card(page, "할 일 작업 1")).toBeVisible();
    const elapsed = Date.now() - started;
    console.log(`[perf] 600장 초기 로딩 ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2000);
    await expect(page.getByTestId("column-count-DONE")).toHaveText(/카드 200개/);
  });

  test("카드 600장에서 드래그 중 긴 프레임이 5% 미만이다", async ({ page }) => {
    await page.goto("/");
    const source = card(page, "할 일 작업 1");
    await expect(source).toBeVisible();

    await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __recording: boolean };
      w.__frames = [];
      w.__recording = true;
      let last = performance.now();
      const tick = (now: number) => {
        w.__frames.push(now - last);
        last = now;
        if (w.__recording) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const from = (await source.boundingBox())!;
    const to = (await column(page, "IN_PROGRESS").boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + 30, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 60 });
    await page.mouse.up();

    const frames = await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __recording: boolean };
      w.__recording = false;
      return w.__frames.slice(1);
    });
    const long = frames.filter((ms) => ms > 50).length;
    const ratio = long / frames.length;
    console.log(
      `[perf] 프레임 ${frames.length}개, 50ms 초과 ${long}개 (${(ratio * 100).toFixed(1)}%), 최대 ${Math.max(...frames).toFixed(0)}ms`,
    );
    expect(ratio).toBeLessThan(0.05);
    await expect(card(page, "할 일 작업 1")).toHaveAttribute("data-status", "IN_PROGRESS");
  });
});
