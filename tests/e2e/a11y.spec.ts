import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { card, openWith, titlesIn } from "./helpers";

const liveRegion = (page: Page) => page.locator("[id^=DndLiveRegion]");

/**
 * 키보드로 카드를 집는다. dnd-kit은 집은 뒤 드롭 대상 측정과 키 리스너 등록을 비동기로 하므로,
 * 사람처럼 잠깐 기다린 뒤 방향키를 누른다(바로 누르면 Edge에서 키가 무시될 수 있다).
 */
async function pickUp(page: Page, title: string) {
  await card(page, title).focus();
  await page.keyboard.press("Space");
  await expect(liveRegion(page)).toContainText(`'${title}' 카드를 집었습니다`);
  await page.waitForTimeout(200);
}

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

test.describe("키보드 조작 (T-029)", () => {
  test("Tab으로 첫 카드에 포커스할 수 있다", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["첫 카드"] }));
    await page.keyboard.press("Tab");
    await expect(card(page, "첫 카드")).toBeFocused();
  });

  test("키보드만으로 할 일에서 완료까지 옮긴다 (SC-7)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["키보드 카드"] }));
    await pickUp(page, "키보드 카드");
    await page.keyboard.press("ArrowRight");
    await expect(liveRegion(page)).toContainText("진행 중 컬럼");
    await page.keyboard.press("ArrowRight");
    await expect(liveRegion(page)).toContainText("완료 컬럼");
    await page.keyboard.press("Space");

    await expect(card(page, "키보드 카드")).toHaveAttribute("data-status", "DONE");
    await expect(liveRegion(page)).toContainText("완료 컬럼 1번째 위치에 놓았습니다");
    await expect(card(page, "키보드 카드")).toBeFocused();
  });

  test("키보드 드래그 중 Esc로 취소한다", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A", "B"] }));
    await pickUp(page, "A");
    await page.keyboard.press("ArrowRight");
    await expect(liveRegion(page)).toContainText("진행 중 컬럼");
    await page.keyboard.press("Escape");
    await expect(liveRegion(page)).toContainText("이동을 취소했습니다");
    await expect(card(page, "A")).toHaveAttribute("data-status", "TODO");
    expect(await titlesIn(page, "TODO")).toEqual(["A", "B"]);
  });

  test("카드 안 버튼의 Space/Enter는 드래그를 시작하지 않는다", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"] }));
    await page.getByRole("button", { name: "'A' 수정" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "카드 수정" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "'A' 수정" })).toBeFocused();
  });
});

test.describe("접근성 검사 (T-029, NFR-6)", () => {
  test("빈 보드에 WCAG 2.1 AA 위반이 없다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("column-TODO")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("카드가 있는 보드에 WCAG 2.1 AA 위반이 없다", async ({ page }) => {
    await openWith(
      page,
      buildStoredBoard({ TODO: ["할 일 카드"], IN_PROGRESS: ["진행 카드"], DONE: ["완료 카드"] }),
    );
    await expectNoAxeViolations(page);
  });

  test("다이얼로그가 열린 상태에 WCAG 2.1 AA 위반이 없다", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"] }));
    await page.getByRole("button", { name: "+ 카드 추가" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "추가" }).click();
    await expect(page.getByText("제목을 입력하세요.")).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "'A' 삭제" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
