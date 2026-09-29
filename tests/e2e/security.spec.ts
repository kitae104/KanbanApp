import { expect, test } from "@playwright/test";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { addCard, card, column, drag, openWith } from "./helpers";

test.describe("보안 헤더 (T-024)", () => {
  test("응답에 보안 헤더가 있다", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("보드를 쓰는 동안 CSP 위반과 페이지 오류가 없다", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (/Content Security Policy|CSP/i.test(message.text())) problems.push(message.text());
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        console.error(`CSP violation: ${event.violatedDirective} ${event.sourceFile}`);
      });
    });

    await openWith(page, buildStoredBoard({ TODO: ["A"] }));
    await addCard(page, "B");
    await drag(page, card(page, "A"), column(page, "DONE"));
    await expect(card(page, "A")).toHaveAttribute("data-status", "DONE");
    await page.getByRole("button", { name: "'B' 삭제" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "삭제" }).click();
    await expect(card(page, "B")).toHaveCount(0);

    expect(problems).toEqual([]);
  });
});
