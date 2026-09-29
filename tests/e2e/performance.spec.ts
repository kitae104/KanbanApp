import { expect, test } from "./fixtures";
import { buildLargeBoard, buildStoredBoard } from "../fixtures/seedBoard";
import { card, column, openWith, sameOrigin } from "./helpers";

/** 서버 보드에 카드를 채운다. 측정은 그다음 페이지 이동부터 한다. */
async function seed(page: import("@playwright/test").Page, stored: unknown) {
  const response = await page.request.post("/api/board/import", {
    data: stored,
    headers: sameOrigin(page),
  });
  expect(response.status()).toBe(200);
}

test.describe("성능 (T-030, SC-9)", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, buildLargeBoard(200));
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

test.describe("서버 저장 성능 (db-integration NFR-9, NFR-10)", () => {
  test("카드 100장 보드가 로그인 후 1초 안에 보인다 (NFR-9)", async ({ page }) => {
    await seed(
      page,
      buildStoredBoard({
        TODO: Array.from({ length: 34 }, (_, i) => `할 일 ${i + 1}`),
        IN_PROGRESS: Array.from({ length: 33 }, (_, i) => `진행 ${i + 1}`),
        DONE: Array.from({ length: 33 }, (_, i) => `완료 ${i + 1}`),
      }),
    );
    const started = Date.now();
    await page.goto("/");
    await expect(card(page, "완료 33")).toBeVisible();
    const elapsed = Date.now() - started;
    console.log(`[perf] 100장 서버 조회 포함 첫 표시 ${elapsed}ms`);
    expect(elapsed).toBeLessThan(1000);
  });

  test("카드 이동 저장 API의 p95가 150ms 이하다 (NFR-10)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"], IN_PROGRESS: Array.from({ length: 30 }, (_, i) => `카드 ${i}`) }));
    const board = await (await page.request.get("/api/board")).json();
    const id = board.columns.TODO[0];
    // 첫 요청은 서버 워밍업이라 뺀다.
    await page.request.post(`/api/board/cards/${id}/move`, { data: { toStatus: "DONE", toIndex: 0 }, headers: sameOrigin(page) });

    const durations: number[] = [];
    const targets = ["IN_PROGRESS", "DONE", "TODO"] as const;
    for (let i = 0; i < 20; i++) {
      const started = performance.now();
      const response = await page.request.post(`/api/board/cards/${id}/move`, {
        data: { toStatus: targets[i % 3], toIndex: i % 5 },
        headers: sameOrigin(page),
      });
      durations.push(performance.now() - started);
      expect(response.status()).toBe(200);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    console.log(`[perf] 이동 API p50 ${durations[9].toFixed(0)}ms, p95 ${p95.toFixed(0)}ms`);
    expect(p95).toBeLessThan(150);
  });
});
