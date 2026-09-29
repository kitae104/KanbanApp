import { expect, type Locator, type Page } from "@playwright/test";

export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export const STORAGE_KEY = "kanban-app:board";

export const column = (page: Page, status: Status) => page.getByTestId(`column-${status}`);

export const card = (page: Page, title: string) =>
  page.getByRole("group", { name: title, exact: true });

/** 컬럼 안 카드 제목을 위에서부터 순서대로 돌려준다. */
export const titlesIn = (page: Page, status: Status) =>
  column(page, status).getByRole("heading", { level: 3 }).allTextContents();

/** 저장 데이터를 넣고 새로고침해 보드를 그 상태로 연다. */
export async function openWith(page: Page, stored: unknown) {
  await page.goto("/");
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(stored)] as const,
  );
  await page.reload();
  await expect(column(page, "TODO")).toBeVisible();
}

export async function readStored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), STORAGE_KEY);
}

export async function addCard(page: Page, title: string, description = "") {
  await page.getByRole("button", { name: "+ 카드 추가" }).click();
  const dialog = page.getByRole("dialog", { name: "카드 추가" });
  await dialog.getByLabel(/제목/).fill(title);
  if (description) await dialog.getByLabel(/설명/).fill(description);
  await dialog.getByRole("button", { name: "추가" }).click();
}

type Where = "top" | "center" | "bottom";

async function pointIn(locator: Locator, where: Where = "center") {
  const box = await locator.boundingBox();
  if (!box) throw new Error("요소가 화면에 없습니다.");
  const y = { top: box.y + 8, center: box.y + box.height / 2, bottom: box.y + box.height - 8 }[
    where
  ];
  return { x: box.x + box.width / 2, y };
}

/**
 * 마우스로 source를 target 위치까지 끌어다 놓는다.
 * MouseSensor의 활성화 거리(5px)를 넘기도록 먼저 조금 움직인 뒤 단계적으로 이동한다.
 */
export async function drag(
  page: Page,
  source: Locator,
  target: Locator,
  { where = "center", drop = true }: { where?: Where; drop?: boolean } = {},
) {
  const from = await pointIn(source);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 5 });
  const to = await pointIn(target, where);
  await page.mouse.move(to.x, to.y, { steps: 20 });
  // 드롭 대상 계산이 끝나도록 같은 자리에서 한 번 더 움직인다.
  await page.mouse.move(to.x, to.y + 1, { steps: 2 });
  if (drop) {
    await page.mouse.up();
    // dnd-kit은 놓은 직후 50ms 동안 클릭을 막는다(드롭이 클릭으로 처리되지 않게). 사람은 그보다 느리다.
    await page.waitForTimeout(100);
  }
}
