"use client";

import { useContext } from "react";
import { BoardContext, type BoardContextValue } from "@/components/board/BoardProvider";

export function useBoard(): BoardContextValue {
  const context = useContext(BoardContext);
  if (!context) throw new Error("useBoard는 <BoardProvider> 안에서만 사용할 수 있습니다.");
  return context;
}
