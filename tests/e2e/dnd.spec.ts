import { expect, test } from "@playwright/test";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { card, column, drag, openWith, readStored, titlesIn, type Status } from "./helpers";

const STATUSES: Status[] = ["TODO", "IN_PROGRESS", "DONE"];
const DIRECTIONS = STATUSES.flatMap((from) =>
  STATUSES.filter((to) => to !== from).map((to) => [from, to] as const),
);

test.describe("마우스 드래그 (T-027)", () => {
  for (const [from, to] of DIRECTIONS) {
    test(`${from} → ${to} 이동 시 상태가 대상 컬럼이 된다 (SC-3)`, async ({ page }) => {
      await openWith(page, buildStoredBoard({ [from]: ["옮길 카드", "남는 카드"], [to]: ["대상 카드"] }));
      // 대상 컬럼의 카드 아래 빈 공간에 놓으면 맨 끝에 들어간다.
      await drag(page, card(page, "옮길 카드"), column(page, to), { where: "bottom" });

      await expect(card(page, "옮길 카드")).toHaveAttribute("data-status", to);
      expect(await titlesIn(page, to)).toEqual(["대상 카드", "옮길 카드"]);
      expect(await titlesIn(page, from)).toEqual(["남는 카드"]);
      const stored = await readStored(page);
      expect(stored.board.columns[to]).toHaveLength(2);
    });
  }

  test("다른 컬럼의 카드 위쪽에 놓으면 그 카드 앞에 들어간다 (FR-12)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"], DONE: ["X", "Y"] }));
    await drag(page, card(page, "A"), card(page, "X"), { where: "top" });
    await expect(card(page, "A")).toHaveAttribute("data-status", "DONE");
    expect(await titlesIn(page, "DONE")).toEqual(["A", "X", "Y"]);
  });

  test("빈 컬럼에 놓을 수 있다 (FR-16)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["혼자"] }));
    await drag(page, card(page, "혼자"), column(page, "IN_PROGRESS"));
    await expect(card(page, "혼자")).toHaveAttribute("data-status", "IN_PROGRESS");
    await expect(page.getByTestId("column-count-TODO")).toHaveText(/카드 0개/);
  });

  test("같은 컬럼에서 순서만 바뀌고 상태는 그대로다 (SC-4)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ IN_PROGRESS: ["첫째", "둘째", "셋째"] }));
    await drag(page, card(page, "첫째"), card(page, "셋째"), { where: "bottom" });
    await expect.poll(() => titlesIn(page, "IN_PROGRESS")).toEqual(["둘째", "셋째", "첫째"]);
    await expect(card(page, "첫째")).toHaveAttribute("data-status", "IN_PROGRESS");
  });

  test("드래그 중 Esc를 누르면 원래 자리로 돌아간다 (SC-5)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A", "B"], DONE: ["X"] }));
    await drag(page, card(page, "A"), card(page, "X"), { drop: false });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    expect(await titlesIn(page, "TODO")).toEqual(["A", "B"]);
    expect(await titlesIn(page, "DONE")).toEqual(["X"]);
    await expect(card(page, "A")).toHaveAttribute("data-status", "TODO");
  });

  test("컬럼 밖에 놓으면 원래 자리로 돌아간다 (SC-5)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A", "B"], DONE: ["X"] }));
    await drag(page, card(page, "A"), page.getByRole("heading", { name: "칸반 보드" }));
    expect(await titlesIn(page, "TODO")).toEqual(["A", "B"]);
    await expect(card(page, "A")).toHaveAttribute("data-status", "TODO");
    const stored = await readStored(page);
    expect(stored.board.columns.TODO).toEqual(["todo-0", "todo-1"]);
  });

  test("드래그 중 대상 컬럼을 강조한다 (FR-13)", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"], DONE: ["X"] }));
    await drag(page, card(page, "A"), column(page, "DONE"), { drop: false });
    await expect(column(page, "DONE")).toHaveClass(/ring-2/);
    await expect(column(page, "TODO")).not.toHaveClass(/ring-2/);
    await page.mouse.up();
    await expect(column(page, "DONE")).not.toHaveClass(/ring-2/);
  });

  test("카드 안의 버튼 클릭은 드래그로 처리되지 않는다", async ({ page }) => {
    await openWith(page, buildStoredBoard({ TODO: ["A"] }));
    await page.getByRole("button", { name: "'A' 수정" }).click();
    await expect(page.getByRole("dialog", { name: "카드 수정" })).toBeVisible();
  });
});
