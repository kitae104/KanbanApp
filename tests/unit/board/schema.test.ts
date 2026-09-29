import { describe, expect, it } from "vitest";
import { cardInputSchema, storedBoardSchema } from "@/lib/board/schema";
import { makeBoard } from "./helpers";

describe("cardInputSchema", () => {
  it.each([
    ["빈 문자열", ""],
    ["공백만", "   \n\t "],
    ["101자", "가".repeat(101)],
  ])("%s 제목은 거부한다", (_, title) => {
    expect(cardInputSchema.safeParse({ title, description: "" }).success).toBe(false);
  });

  it("빈 제목에는 '제목을 입력하세요.' 오류를 준다", () => {
    const result = cardInputSchema.safeParse({ title: " ", description: "" });
    expect(result.error?.issues[0]?.message).toBe("제목을 입력하세요.");
  });

  it("1001자 설명은 거부한다", () => {
    const result = cardInputSchema.safeParse({ title: "a", description: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("앞뒤 공백을 제거하고, 경계값(100자·1000자)은 허용한다", () => {
    expect(cardInputSchema.parse({ title: "  보고서  ", description: "" }).title).toBe("보고서");
    expect(
      cardInputSchema.safeParse({ title: "가".repeat(100), description: "x".repeat(1000) }).success,
    ).toBe(true);
  });

  it("설명이 없으면 빈 문자열로 채운다", () => {
    expect(cardInputSchema.parse({ title: "a" }).description).toBe("");
  });
});

describe("storedBoardSchema", () => {
  const valid = {
    version: 1,
    savedAt: "2026-01-01T00:00:00.000Z",
    board: makeBoard({ TODO: ["a"] }),
  };

  it("정상 저장 데이터를 통과시킨다", () => {
    expect(storedBoardSchema.safeParse(valid).success).toBe(true);
  });

  it("status가 잘못된 카드는 거부한다", () => {
    const bad = structuredClone(valid);
    (bad.board.cards.a as { status: string }).status = "BLOCKED";
    expect(storedBoardSchema.safeParse(bad).success).toBe(false);
  });

  it("필드가 빠진 카드는 거부한다", () => {
    const bad = structuredClone(valid) as unknown as {
      board: { cards: Record<string, Record<string, unknown>> };
    };
    delete bad.board.cards.a.title;
    expect(storedBoardSchema.safeParse(bad).success).toBe(false);
  });

  it("컬럼이 빠지거나 버전이 다르면 거부한다", () => {
    const noColumn = structuredClone(valid) as unknown as {
      board: { columns: Record<string, unknown> };
    };
    delete noColumn.board.columns.DONE;
    expect(storedBoardSchema.safeParse(noColumn).success).toBe(false);
    expect(storedBoardSchema.safeParse({ ...valid, version: 2 }).success).toBe(false);
  });
});
