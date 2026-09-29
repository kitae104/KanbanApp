import { getBoard } from "@/server/board/queries";
import { withSession } from "@/server/http/handler";
import { json } from "@/server/http/respond";

/** 세션 유저의 보드 (FR-15). */
export function GET(request: Request) {
  return withSession(request, async ({ boardId }) => json(200, await getBoard(boardId)));
}
