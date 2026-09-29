import { createCardBodySchema } from "@/lib/board/api";
import { addCard } from "@/server/board/queries";
import { parseBody, withSession } from "@/server/http/handler";
import { json, notFound } from "@/server/http/respond";

/** 카드 생성. 보드는 항상 세션 유저의 보드다 (FR-16). */
export function POST(request: Request) {
  return withSession(request, async ({ boardId }) => {
    const body = await parseBody(request, createCardBodySchema);
    if (!body.ok) return body.response;
    const result = await addCard(boardId, body.data);
    return result.ok ? json(201, result.value) : notFound();
  });
}
