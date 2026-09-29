import { cardIdSchema, moveCardBodySchema } from "@/lib/board/api";
import { moveCard } from "@/server/board/queries";
import { parseBody, withSession } from "@/server/http/handler";
import { json, notFound } from "@/server/http/respond";

type Context = { params: Promise<{ id: string }> };

/** 카드 이동. 서버가 순서를 다시 계산하고, 확정된 보드 전체를 돌려준다 (plan D1). */
export function POST(request: Request, { params }: Context) {
  return withSession(request, async ({ boardId }) => {
    const { id } = await params;
    if (!cardIdSchema.safeParse(id).success) return notFound();
    const body = await parseBody(request, moveCardBodySchema);
    if (!body.ok) return body.response;
    const result = await moveCard(boardId, id, body.data.toStatus, body.data.toIndex);
    return result.ok ? json(200, result.value) : notFound();
  });
}
