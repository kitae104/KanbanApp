"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { BoardAction } from "@/lib/board/actions";
import { createEmptyBoard } from "@/lib/board/operations";
import { boardReducer } from "@/lib/board/reducer";
import type { BoardState } from "@/lib/board/types";
import type { BoardRepository, LoadResult } from "@/lib/storage/boardRepository";
import {
  STORAGE_KEY,
  localStorageBoardRepository,
} from "@/lib/storage/localStorageBoardRepository";

export interface ToastMessage {
  id: number;
  message: string;
}

export interface BoardContextValue {
  board: BoardState;
  /** 렌더를 기다리지 않고 최신 보드를 읽는다(드래그 이벤트처럼 연속으로 호출되는 곳에서 사용). */
  getBoard: () => BoardState;
  isHydrated: boolean;
  /** 상태를 바꾸고 저장한다. 저장에 실패하면 마지막 저장 상태로 되돌리고 false를 돌려준다. */
  commit: (action: BoardAction) => boolean;
  /** 저장 없이 화면용 상태만 바꾼다(드래그 중 미리보기). */
  preview: (action: BoardAction) => void;
  /** 드래그 중에는 다른 탭의 변경을 반영하지 않는다. */
  setDragging: (dragging: boolean) => void;
  toast: ToastMessage | null;
  dismissToast: () => void;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

export const MESSAGES = {
  saveFailed: "저장에 실패했습니다. 마지막으로 저장된 상태로 되돌렸습니다.",
  corrupt: "저장된 보드를 읽을 수 없어 빈 보드로 시작합니다.",
  unavailable: "브라우저 저장소를 사용할 수 없어 보드를 저장하거나 바꿀 수 없습니다.",
} as const;

function boardFrom(result: LoadResult | null): BoardState {
  return result?.ok ? result.board : createEmptyBoard();
}

function toastFrom(result: LoadResult | null): ToastMessage | null {
  if (!result || result.ok || result.reason === "empty") return null;
  return { id: 0, message: MESSAGES[result.reason] };
}

const subscribeNothing = () => () => {};

/** 서버 렌더와 hydration 중에는 false, 그 뒤로는 true (plan §3 결정 4). */
function useIsClient() {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

interface BoardProviderProps {
  children: ReactNode;
  repository?: BoardRepository;
}

export function BoardProvider({
  children,
  repository = localStorageBoardRepository,
}: BoardProviderProps) {
  // 서버에는 localStorage가 없다. 브라우저에서 처음 렌더할 때 한 번만 읽는다.
  // 화면은 isHydrated가 된 뒤에만 보드를 그리므로 서버 HTML과 어긋나지 않는다.
  const [initialLoad] = useState(() =>
    typeof window === "undefined" ? null : repository.load(),
  );
  const [board, dispatch] = useReducer(boardReducer, initialLoad, boardFrom);
  const [toast, setToast] = useState(() => toastFrom(initialLoad));
  const isHydrated = useIsClient();

  // 리듀서 결과를 동기적으로 알아야 저장 성공 여부로 적용/롤백을 정할 수 있다.
  const boardRef = useRef(board);
  const lastSavedRef = useRef(board);
  const draggingRef = useRef(false);

  const apply = useCallback((action: BoardAction) => {
    boardRef.current = boardReducer(boardRef.current, action);
    dispatch(action);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  const hydrate = useCallback(
    (loaded: BoardState) => {
      apply({ type: "HYDRATE", board: loaded });
      lastSavedRef.current = loaded;
    },
    [apply],
  );

  // 같은 브라우저의 다른 탭에서 바뀐 보드를 반영한다 (T-015).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || draggingRef.current) return;
      const result = repository.load();
      if (result.ok) hydrate(result.board);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [repository, hydrate]);

  const commit = useCallback(
    (action: BoardAction) => {
      const next = boardReducer(boardRef.current, action);
      if (next === lastSavedRef.current) {
        apply(action);
        return true;
      }
      const result = repository.save(next);
      if (!result.ok) {
        apply({ type: "RESTORE", board: lastSavedRef.current });
        showToast(MESSAGES.saveFailed);
        return false;
      }
      apply(action);
      lastSavedRef.current = next;
      return true;
    },
    [apply, repository, showToast],
  );

  const setDragging = useCallback((dragging: boolean) => {
    draggingRef.current = dragging;
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);
  const getBoard = useCallback(() => boardRef.current, []);

  const value = useMemo<BoardContextValue>(
    () => ({
      board,
      getBoard,
      isHydrated,
      commit,
      preview: apply,
      setDragging,
      toast,
      dismissToast,
    }),
    [board, getBoard, isHydrated, commit, apply, setDragging, toast, dismissToast],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
