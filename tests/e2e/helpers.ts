import { expect, type Locator, type Page } from "@playwright/test";

export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export const STORAGE_KEY = "kanban-app:board";

interface BoardState {
  cards: Record<string, { id: string; title: string; status: Status }>;
  columns: Record<Status, string[]>;
}

export const column = (page: Page, status: Status) => page.getByTestId(`column-${status}`);

export const card = (page: Page, title: string) =>
  page.getByRole("group", { name: title, exact: true });

/**
 * 컬럼 안 카드 제목을 위에서부터 순서대로 돌려준다.
 * 보드는 스트리밍되므로(loading.tsx 스켈레톤 → 보드) 실제 컬럼이 나타날 때까지 먼저 기다린다.
 */
export async function titlesIn(page: Page, status: Status) {
  await expect(column(page, status)).toBeVisible();
  return column(page, status).getByRole("heading", { level: 3 }).allTextContents();
}

/** 상태를 바꾸는 API 요청은 같은 출처(Origin)여야 한다 (NFR-4). */
export const sameOrigin = (page: Page) => ({ origin: new URL(page.url()).origin });

/**
 * 로그인한 유저의 보드를 이 저장 형식(기존 localStorage 형식) 그대로 채우고 보드를 연다.
 * 서버의 가져오기 API를 쓰므로 카드 id는 서버가 새로 발급한다.
 */
export async function openWith(page: Page, stored: unknown) {
  if (!page.url().startsWith("http")) await page.goto("/");
  const response = await page.request.post("/api/board/import", {
    data: stored,
    headers: sameOrigin(page),
  });
  expect(response.status(), await response.text()).toBe(200);
  await page.goto("/");
  await expect(column(page, "TODO")).toBeVisible();
}

/** 서버에 저장된 보드. */
export async function readBoard(page: Page): Promise<BoardState> {
  const response = await page.request.get("/api/board");
  expect(response.status()).toBe(200);
  return response.json();
}

/** 서버에 저장된 컬럼의 카드 제목 순서. 저장은 비동기라 expect.poll과 함께 쓴다. */
export async function storedTitles(page: Page, status: Status): Promise<string[]> {
  const board = await readBoard(page);
  return board.columns[status].map((id) => board.cards[id].title);
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
