import type { z } from "zod";
import type { boardStateSchema, cardSchema } from "./schema";

export const STATUSES =["TODO", "IN_PROGRESS", "DONE"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  TODO: "할 일",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
};

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;

// 형태의 기준은 zod 스키마다. 카드의 status/order는 columns에서 파생되며
// 리듀서가 항상 동기화한다. columns는 카드 위치와 상태의 단일 기준이다(C2).
export type Card = z.infer<typeof cardSchema>;
export type BoardState = z.infer<typeof boardStateSchema>;

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}
