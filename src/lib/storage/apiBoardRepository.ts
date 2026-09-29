import { BOARD_API } from "@/lib/board/api";
import type { BoardRepository, RepoError, RepoResult } from "./boardRepository";

const STATUS_ERRORS: Record<number, RepoError> = {
  400: "invalid",
  401: "unauthorized",
  403: "unauthorized",
  404: "not_found",
  409: "conflict",
};

export function toRepoError(status: number): RepoError {
  return STATUS_ERRORS[status] ?? "server";
}

async function send<T>(method: string, url: string, body?: unknown): Promise<RepoResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "network" };
  }
  if (!response.ok) return { ok: false, error: toRepoError(response.status) };
  if (response.status === 204) return { ok: true, value: null as T };
  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, error: "server" };
  }
}

/** 보드 API(/api/board/*)를 쓰는 저장소 (plan §5.3). */
export const apiBoardRepository: BoardRepository = {
  addCard: (input) => send("POST", BOARD_API.cards, input),
  updateCard: (id, input) => send("PATCH", BOARD_API.card(id), input),
  deleteCard: (id) => send("DELETE", BOARD_API.card(id)),
  moveCard: (id, toStatus, toIndex) => send("POST", BOARD_API.move(id), { toStatus, toIndex }),
  importBoard: (stored) => send("POST", BOARD_API.import, stored),
};
