import { expect, test } from "./fixtures";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { addCard, card, column, openWith, titlesIn } from "./helpers";

test.describe("보드 표시와 카드 CRUD (T-026)", () => {
  test("첫 방문 시 3개 컬럼이 순서대로 보인다 (SC-1)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["할 일", "진행 중", "완료"]);
    for (const status of ["TODO", "IN_PROGRESS", "DONE"] as const) {
      await expect(page.getByTestId(`column-count-${status}`)).toHaveText(/카드 0개/);
    }
  });

  test("카드를 만들면 할 일 맨 아래에 생기고 카드 수가 1 늘어난다 (SC-2)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["기존 카드"] }));
    await addCard(page, "새 카드", "설명입니다");
    expect(await titlesIn(page, "TODO")).toEqual(["기존 카드", "새 카드"]);
    await expect(page.getByTestId("column-count-TODO")).toHaveText(/카드 2개/);
    await expect(card(page, "새 카드")).toHaveAttribute("data-status", "TODO");
  });

  test("빈 제목으로는 만들 수 없고 오류가 보인다 (SC-8)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "+ 카드 추가" }).click();
    const dialog = page.getByRole("dialog", { name: "카드 추가" });
    await dialog.getByLabel(/제목/).fill("   ");
    await dialog.getByRole("button", { name: "추가" }).click();
    await expect(dialog.getByText("제목을 입력하세요.")).toBeVisible();
    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(page.getByTestId("column-count-TODO")).toHaveText(/카드 0개/);
  });

  test("카드를 수정할 수 있다 (FR-7)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ IN_PROGRESS: ["원래 제목"] }));
    await page.getByRole("button", { name: "'원래 제목' 수정" }).click();
    const dialog = page.getByRole("dialog", { name: "카드 수정" });
    await expect(dialog.getByLabel(/제목/)).toHaveValue("원래 제목");
    await dialog.getByLabel(/제목/).fill("바뀐 제목");
    await dialog.getByRole("button", { name: "저장" }).click();
    expect(await titlesIn(page, "IN_PROGRESS")).toEqual(["바뀐 제목"]);
  });

  test("삭제는 확인을 거친다 (FR-8)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ DONE: ["지울 카드", "남길 카드"] }));
    await page.getByRole("button", { name: "'지울 카드' 삭제" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "취소" }).click();
    expect(await titlesIn(page, "DONE")).toEqual(["지울 카드", "남길 카드"]);

    await page.getByRole("button", { name: "'지울 카드' 삭제" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
    expect(await titlesIn(page, "DONE")).toEqual(["남길 카드"]);
    await expect(column(page, "DONE").getByTestId("column-count-DONE")).toHaveText(/카드 1개/);
  });
});
