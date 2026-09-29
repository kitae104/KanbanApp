import { Board } from "@/components/board/Board";
import { BoardProvider } from "@/components/board/BoardProvider";
import { ImportPrompt } from "@/components/board/ImportPrompt";
import { requireSession } from "@/server/auth/dal";
import { getBoard } from "@/server/board/queries";

/** 세션 유저의 보드를 서버에서 조회해 첫 화면에 바로 그린다 (plan D4, NFR-9). */
export default async function BoardPage() {
  const { boardId } = await requireSession();
  const board = await getBoard(boardId);

  return (
    <BoardProvider initialBoard={board}>
      <ImportPrompt />
      <Board />
    </BoardProvider>
  );
}
