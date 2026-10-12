import { z } from "zod";
import { DESCRIPTION_MAX, STATUSES, TITLE_MAX } from "./types";

// zod는 기본적으로 Function("")으로 eval 가능 여부를 확인해 CSP 위반 보고가 남는다.
// CSP에서 eval을 막으므로 JIT를 끈다 (T-024).
z.config({ jitless: true });

const titleSchema = z
  .string()
  .trim()
  .min(1, "제목을 입력하세요.")
  .max(TITLE_MAX, `제목은 ${TITLE_MAX}자 이하여야 합니다.`);

const descriptionSchema = z
  .string()
  .max(DESCRIPTION_MAX, `설명은 ${DESCRIPTION_MAX}자 이하여야 합니다.`);

/** 카드 생성·수정 폼 입력 (FR-4, FR-6). */
export const cardInputSchema = z.object({
  title: titleSchema,
  description: descriptionSchema.default(""),
});
export type CardInput = z.infer<typeof cardInputSchema>;

export const statusSchema = z.enum(STATUSES);

export const cardSchema = z.object({
  id: z.string().min(1),
  title: titleSchema,
  description: descriptionSchema,
  status: statusSchema,
  order: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const boardStateSchema = z
  .object({
    cards: z.record(z.string(), cardSchema),
    columns: z.record(statusSchema, z.array(z.string())),
  })
  .superRefine((board, ctx) => {
    // columns가 카드 위치의 기준이므로, 모든 카드가 정확히 한 컬럼에 한 번씩 있어야 한다.
    const ids = Object.values(board.columns).flat();
    const consistent =
      new Set(ids).size === ids.length &&
      ids.length === Object.keys(board.cards).length &&
      ids.every((id) => id in board.cards);
    if (!consistent) {
      ctx.addIssue({ code: "custom", message: "cards와 columns가 일치하지 않습니다." });
    }
  });

export const STORAGE_VERSION = 1;

/** localStorage에 저장하는 봉투 형식 (plan §4.2). */
export const storedBoardSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  savedAt: z.iso.datetime(),
  board: boardStateSchema,
});
export type StoredBoard = z.infer<typeof storedBoardSchema>;
