"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BoardAction } from "@/lib/board/actions";
import { boardReducer } from "@/lib/board/reducer";
import type { BoardState } from "@/lib/board/types";
import { apiBoardRepository } from "@/lib/storage/apiBoardRepository";
import type { BoardRepository, RepoError, RepoResult } from "@/lib/storage/boardRepository";

export interface ToastMessage {
  id: number;
  message: string;
}

export interface BoardContextValue {
  board: BoardState;
  /** 렌더를 기다리지 않고 최신 보드를 읽는다(드래그 이벤트처럼 연속으로 호출되는 곳에서 사용). */
  getBoard: () => BoardState;
  /** 보드는 서버에서 받아 오므로 처음부터 true다. Board의 스켈레톤 분기와의 호환용이다. */
  isHydrated: boolean;
  /**
   * 화면에 바로 반영하고(낙관적 업데이트) 서버에 순서대로 저장한다.
   * 저장에 실패하면 서버에 확정된 마지막 상태로 되돌리고 false로 끝난다.
   */
  commit: (action: BoardAction) => Promise<boolean>;
  /** 저장 없이 화면용 상태만 바꾼다(드래그 중 미리보기). */
  preview: (action: BoardAction) => void;
  /** 드래그 중에는 서버 응답으로 화면을 다시 맞추지 않는다. */
  setDragging: (dragging: boolean) => void;
  /** 로컬 보드를 서버로 가져온다 (FR-25). */
  importBoard: (stored: unknown) => Promise<boolean>;
  toast: ToastMessage | null;
  dismissToast: () => void;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

export const MESSAGES = {
  saveFailed: "저장에 실패했습니다. 마지막으로 저장된 상태로 되돌렸습니다.",
  sessionExpired: "로그인이 만료되었습니다. 다시 로그인하세요.",
  importFailed: "카드를 가져오지 못했습니다. 잠시 뒤 다시 시도하세요.",
  imported: "이 브라우저에 저장된 카드를 가져왔습니다.",
} as const;

function goToLogin() {
  window.location.replace("/login");
}

interface BoardProviderProps {
  children: ReactNode;
  /** 서버 컴포넌트가 세션 유저의 보드를 조회해 넘긴다 (plan D4). */
  initialBoard: BoardState;
  repository?: BoardRepository;
  /** 세션이 만료됐을 때 (기본: /login으로 이동). */
  onUnauthorized?: () => void;
}

export function BoardProvider({
  children,
  initialBoard,
  repository = apiBoardRepository,
  onUnauthorized = goToLogin,
}: BoardProviderProps) {
  const [board, dispatch] = useReducer(boardReducer, initialBoard);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // 리듀서 결과를 동기적으로 알아야 드래그처럼 연속된 이벤트에서 최신 보드를 쓸 수 있다.
  const boardRef = useRef(board);
  /** 서버에 확정된 마지막 보드. 실패하면 여기로 되돌린다. */
  const confirmedRef = useRef(initialBoard);
  const draggingRef = useRef(false);
  /** 저장 요청을 순서대로 보내는 큐 (plan §7.1). */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRef = useRef(0);
  /** 실패하면 1 올린다. 이전 세대에 대기 중이던 요청은 보내지 않고 버린다. */
  const generationRef = useRef(0);

  const apply = useCallback((action: BoardAction) => {
    boardRef.current = boardReducer(boardRef.current, action);
    dispatch(action);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  const fail = useCallback(
    (error: RepoError) => {
      generationRef.current += 1;
      pendingRef.current = 0;
      apply({ type: "RESTORE", board: confirmedRef.current });
      if (error === "unauthorized") {
        showToast(MESSAGES.sessionExpired);
        onUnauthorized();
      } else {
        showToast(MESSAGES.saveFailed);
      }
    },
    [apply, showToast, onUnauthorized],
  );

  const send = useCallback(
    (action: BoardAction): Promise<RepoResult<unknown>> => {
      switch (action.type) {
        case "ADD_CARD":
          return repository.addCard({
            id: action.id,
            title: action.title,
            description: action.description,
          });
        case "UPDATE_CARD":
          return repository.updateCard(action.id, {
            title: action.title,
            description: action.description,
          });
        case "DELETE_CARD":
          return repository.deleteCard(action.id);
        case "MOVE_CARD":
          return repository.moveCard(action.id, action.toStatus, action.toIndex);
        default:
          return Promise.resolve({ ok: true, value: null });
      }
    },
    [repository],
  );

  const commit = useCallback(
    (action: BoardAction): Promise<boolean> => {
      if (boardReducer(boardRef.current, action) === boardRef.current) return Promise.resolve(true);
      apply(action);

      const generation = generationRef.current;
      pendingRef.current += 1;
      const task = queueRef.current.then(async () => {
        // 앞선 요청이 실패해 되돌렸으면 이 변경도 이미 화면에서 사라졌다.
        if (generation !== generationRef.current) return false;
        const result = await send(action).catch(
          (): RepoResult<unknown> => ({ ok: false, error: "network" }),
        );
        if (generation !== generationRef.current) return false;
        if (!result.ok) {
          fail(result.error);
          return false;
        }
        pendingRef.current -= 1;
        if (action.type === "MOVE_CARD") {
          // 이동은 서버가 다시 계산한 보드가 기준이다.
          confirmedRef.current = result.value as BoardState;
          // 대기 중인 변경이 없고 드래그 중이 아닐 때만 화면을 서버 기준으로 맞춘다.
          if (pendingRef.current === 0 && !draggingRef.current) {
            apply({ type: "HYDRATE", board: confirmedRef.current });
          }
        } else {
          confirmedRef.current = boardReducer(confirmedRef.current, action);
        }
        return true;
      });
      queueRef.current = task;
      return task;
    },
    [apply, send, fail],
  );

  const importBoard = useCallback(
    async (stored: unknown) => {
      const result = await repository.importBoard(stored);
      if (!result.ok) {
        if (result.error === "unauthorized") fail(result.error);
        else showToast(MESSAGES.importFailed);
        return false;
      }
      confirmedRef.current = result.value;
      apply({ type: "HYDRATE", board: result.value });
      showToast(MESSAGES.imported);
      return true;
    },
    [repository, apply, fail, showToast],
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
      isHydrated: true,
      commit,
      preview: apply,
      setDragging,
      importBoard,
      toast,
      dismissToast,
    }),
    [board, getBoard, commit, apply, setDragging, importBoard, toast, dismissToast],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
