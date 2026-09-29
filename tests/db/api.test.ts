import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, insertSession } from "@/server/auth/session";
import { buildStoredBoard } from "../fixtures/seedBoard";
import { cardRows, createUser, type TestUser } from "./helpers";

// 요청마다 "현재 로그인한 유저"의 쿠키를 흉내 낸다.
let sessionToken: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE && sessionToken ? { name, value: sessionToken } : undefined,
  }),
}));

const boardRoute = await import("@/app/api/board/route");
const cardsRoute = await import("@/app/api/board/cards/route");
const cardRoute = await import("@/app/api/board/cards/[id]/route");
const moveRoute = await import("@/app/api/board/cards/[id]/move/route");
const importRoute = await import("@/app/api/board/import/route");

const ORIGIN = "http://localhost:3000";
const request = (method: string, body?: unknown, origin: string | null = ORIGIN) =>
  new Request(`${ORIGIN}/api/board`, {
    method,
    headers: {
      host: "localhost:3000",
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function loginAs(user: TestUser) {
  sessionToken = (await insertSession(user.userId)).token;
}

async function createCard(title: string) {
  const id = randomUUID();
  const response = await cardsRoute.POST(request("POST", { id, title, description: "" }));
  expect(response.status).toBe(201);
  return id;
}

beforeEach(() => {
  sessionToken = undefined;
});

describe("인증과 Origin", () => {
  it("세션이 없으면 401이다", async () => {
    const response = await boardRoute.GET(request("GET"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("상태를 바꾸는 요청의 Origin이 다르거나 없으면 403이다", async () => {
    await loginAs(await createUser());
    const body = { id: randomUUID(), title: "x", description: "" };
    expect((await cardsRoute.POST(request("POST", body, "https://evil.example"))).status).toBe(403);
    expect((await cardsRoute.POST(request("POST", body, null))).status).toBe(403);
  });
});

describe("보드 API", () => {
  it("카드 생성·조회·수정·이동·삭제", async () => {
    const user = await createUser();
    await loginAs(user);
    const a = await createCard("가");
    const b = await createCard("나");

    const board = await (await boardRoute.GET(request("GET"))).json();
    expect(board.columns.TODO).toEqual([a, b]);

    const patched = await cardRoute.PATCH(request("PATCH", { title: "가2", description: "d" }), ctx(a));
    expect(patched.status).toBe(200);
    expect((await patched.json()).title).toBe("가2");

    const moved = await moveRoute.POST(request("POST", { toStatus: "DONE", toIndex: 0 }), ctx(b));
    expect(moved.status).toBe(200);
    expect((await moved.json()).columns).toEqual({ TODO: [a], IN_PROGRESS: [], DONE: [b] });

    const deleted = await cardRoute.DELETE(request("DELETE"), ctx(a));
    expect(deleted.status).toBe(204);
    expect((await cardRows(user.boardId)).map((row) => row.id)).toEqual([b]);
  });

  it("빈 제목, 잘못된 JSON, 잘못된 이동 대상은 400이다", async () => {
    await loginAs(await createUser());
    expect((await cardsRoute.POST(request("POST", { id: randomUUID(), title: " " }))).status).toBe(400);

    const broken = new Request(`${ORIGIN}/api/board/cards`, {
      method: "POST",
      headers: { host: "localhost:3000", origin: ORIGIN },
      body: "{not json",
    });
    expect((await cardsRoute.POST(broken)).status).toBe(400);

    const id = await createCard("가");
    const response = await moveRoute.POST(request("POST", { toStatus: "DOING", toIndex: 0 }), ctx(id));
    expect(response.status).toBe(400);
  });

  it("가져오기는 빈 보드에만 되고, 두 번째는 409다", async () => {
    await loginAs(await createUser());
    const stored = buildStoredBoard({ TODO: ["가"], DONE: ["나"] });
    const first = await importRoute.POST(request("POST", stored));
    expect(first.status).toBe(200);
    expect((await importRoute.POST(request("POST", stored))).status).toBe(409);
    expect((await importRoute.POST(request("POST", { nope: true }))).status).toBe(400);
  });
});

describe("다른 유저의 카드 (SC-5)", () => {
  it("B의 세션으로 A의 카드를 수정·삭제·이동하면 모두 같은 404이고, A의 카드는 그대로다", async () => {
    const [a, b] = [await createUser(), await createUser()];
    await loginAs(a);
    const aCard = await createCard("A의 카드");
    const before = await cardRows(a.boardId);

    await loginAs(b);
    const responses = [
      await cardRoute.PATCH(request("PATCH", { title: "탈취", description: "" }), ctx(aCard)),
      await cardRoute.DELETE(request("DELETE"), ctx(aCard)),
      await moveRoute.POST(request("POST", { toStatus: "DONE", toIndex: 0 }), ctx(aCard)),
      await cardRoute.DELETE(request("DELETE"), ctx("not-a-uuid")),
      await cardRoute.DELETE(request("DELETE"), ctx(randomUUID())),
    ];
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    }
    expect(await cardRows(a.boardId)).toEqual(before);

    const bBoard = await (await boardRoute.GET(request("GET"))).json();
    expect(bBoard.cards[aCard]).toBeUndefined();
  });

  it("본문에 boardId·userId를 넣어도 세션 유저의 보드에만 생성된다", async () => {
    const [a, b] = [await createUser(), await createUser()];
    await loginAs(b);
    const id = randomUUID();
    const response = await cardsRoute.POST(
      request("POST", { id, title: "끼워넣기", description: "", boardId: a.boardId, userId: a.userId }),
    );
    expect(response.status).toBe(201);
    expect(await cardRows(a.boardId)).toEqual([]);
    expect((await cardRows(b.boardId)).map((row) => row.id)).toEqual([id]);
  });
});

describe("오류 응답", () => {
  it("DB 오류의 내용은 응답에 드러나지 않는다", async () => {
    await loginAs(await createUser());
    vi.spyOn(console, "error").mockImplementation(() => {});
    const queries = await import("@/server/board/queries");
    vi.spyOn(queries, "getBoard").mockRejectedValueOnce(
      Object.assign(new Error('relation "cards" does not exist'), { code: "42P01" }),
    );
    const response = await boardRoute.GET(request("GET"));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe('{"error":"server"}');
    vi.restoreAllMocks();
  });
});
