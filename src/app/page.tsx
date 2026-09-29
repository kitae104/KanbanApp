import { Board } from "@/components/board/Board";
import { BoardProvider } from "@/components/board/BoardProvider";

export default function Home() {
  return (
    <BoardProvider>
      <Board />
    </BoardProvider>
  );
}
