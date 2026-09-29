import { z } from "zod";
import { cardInputSchema, statusSchema } from "./schema";

// 보드 API 요청 본문 (plan §5.2). 서버 Route Handler와 클라이언트 저장소가 같이 쓴다.

export const BOARD_API = {
  board: "/api/board",
  cards: "/api/board/cards",
  card: (id: string) => `/api/board/cards/${encodeURIComponent(id)}`,
  move: (id: string) => `/api/board/cards/${encodeURIComponent(id)}/move`,
  import: "/api/board/import",
} as const;

export const cardIdSchema = z.uuid();

export const createCardBodySchema = cardInputSchema.extend({ id: cardIdSchema });
export type CreateCardBody = z.infer<typeof createCardBodySchema>;

export const moveCardBodySchema = z.object({
  toStatus: statusSchema,
  toIndex: z.number().int().nonnegative(),
});
export type MoveCardBody = z.infer<typeof moveCardBodySchema>;
