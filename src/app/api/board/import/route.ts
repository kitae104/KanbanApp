import { importBoard } from "@/server/board/queries";
import { withSession } from "@/server/http/handler";
import { conflict, invalid, json } from "@/server/http/respond";

/** 이 브라우저의 localStorage 보드를 빈 서버 보드로 가져온다 (FR-25). */
export function POST(request: Request) {
  return withSession(request, async ({ boardId }) => {
    let stored: unknown;
    try {
      stored = await request.json();
    } catch {
      return invalid();
    }
    const result = await importBoard(boardId, stored);
    if (result.ok) return json(200, result.value);
    return result.error === "conflict" ? conflict() : invalid();
  });
}
