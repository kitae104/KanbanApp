import { cardIdSchema } from "@/lib/board/api";
import { cardInputSchema } from "@/lib/board/schema";
import { deleteCard, updateCard } from "@/server/board/queries";
import { parseBody, withSession } from "@/server/http/handler";
import { json, noContent, notFound } from "@/server/http/respond";

type Context = { params: Promise<{ id: string }> };

// id 형식이 틀려도 없는 카드와 같은 404로 답한다. 다른 유저 카드의 존재 여부를 드러내지 않는다 (FR-19).

export function PATCH(request: Request, { params }: Context) {
  return withSession(request, async ({ boardId }) => {
    const { id } = await params;
    if (!cardIdSchema.safeParse(id).success) return notFound();
    const body = await parseBody(request, cardInputSchema);
    if (!body.ok) return body.response;
    const result = await updateCard(boardId, id, body.data);
    return result.ok ? json(200, result.value) : notFound();
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withSession(request, async ({ boardId }) => {
    const { id } = await params;
    if (!cardIdSchema.safeParse(id).success) return notFound();
    const result = await deleteCard(boardId, id);
    return result.ok ? noContent() : notFound();
  });
}
