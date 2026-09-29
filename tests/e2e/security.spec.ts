import { expect, test } from "./fixtures";
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

test.describe("인증·API 보안 (T-030)", () => {
  test("세션 쿠키는 HttpOnly, SameSite=Lax이고 스크립트로 읽을 수 없다", async ({ page }) => {
    const cookie = (await page.context().cookies()).find((c) => c.name === "kanban_session");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("kanban_session");
  });

  test("다른 출처에서 보낸 변경 요청은 403이다 (NFR-4)", async ({ page }) => {
    const response = await page.request.post("/api/board/cards", {
      data: { id: crypto.randomUUID(), title: "CSRF", description: "" },
      headers: { origin: "https://evil.example" },
    });
    expect(response.status()).toBe(403);
    const board = await (await page.request.get("/api/board")).json();
    expect(Object.keys(board.cards)).toEqual([]);
  });

  test("오류 응답에 SQL·스택 정보가 없다 (NFR-6)", async ({ page }) => {
    const headers = { origin: new URL(page.url()).origin };
    const responses = [
      await page.request.post("/api/board/cards", { data: "{broken", headers }),
      await page.request.post("/api/board/cards", { data: { id: "x", title: "" }, headers }),
      await page.request.post("/api/board/cards/not-a-uuid/move", { data: {}, headers }),
    ];
    for (const response of responses) {
      const text = await response.text();
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(text).not.toMatch(/SELECT|INSERT|cards_|postgres|at \w+ \(|\.ts:\d+/i);
    }
  });
});
