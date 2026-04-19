/**
 * Cloudflare Worker + Durable Object
 * Planning Poker backend
 *
 * ✅ WebSocket handling ONLY inside Durable Object
 * ✅ Worker layer acts as router only
 * ✅ WS requests are forwarded WITHOUT recreating Request
 */

/* =========================
  Types
========================= */

type NumericCardValue = "0" | "1" | "2" | "3" | "5" | "8" | "13" | "21" | "34";
type SpecialCardValue = "?" | "☕";
type VoteModifier = "flat" | "base" | "sharp";
type RoomPhase = "lobby" | "countdown" | "voting" | "revealed";

type VoteChoice =
  | { kind: "estimate"; base: NumericCardValue; modifier: VoteModifier }
  | { kind: "special"; value: SpecialCardValue };

type ClientMessage =
  | { type: "join_room"; roomId: string; name?: string; claimHost?: boolean }
  | { type: "set_name"; name?: string }
  | { type: "set_ticket"; ticketTitle?: string }
  | { type: "vote"; vote?: VoteChoice }
  | { type: "clear_vote" }
  | { type: "start_round" }
  | { type: "reveal_votes" };

declare global {
  interface ResponseInit {
    webSocket?: WebSocket;
  }

  interface WebSocket {
    accept(): void;
  }
}

interface DurableObjectId {
  toString(): string;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

interface DurableObjectState {
  id: DurableObjectId;
}

declare const WebSocketPair: {
  new (): { 0: WebSocket; 1: WebSocket };
};

interface Env {
  ROOM_DO: DurableObjectNamespace;
}

/* =========================
  Helpers
========================= */

const SOCKET_OPEN = 1;

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeRoomId(roomId: string) {
  return roomId.trim().toUpperCase();
}

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

/* =========================
  Durable Object: Room
========================= */

interface Participant {
  id: string;
  name: string;
  vote: VoteChoice | null;
  socket: WebSocket;
}

interface RoomState {
  roomId: string;
  hostId: string | null;
  ticketTitle: string;
  phase: RoomPhase;
  participants: Map<string, Participant>;
}

export class RoomDO {
  private room: RoomState;

  constructor(private state: DurableObjectState, private env: Env) {
    const roomId = this.state.id.toString();
    this.room = {
      roomId,
      hostId: null,
      ticketTitle: "",
      phase: "lobby",
      participants: new Map()
    };
  }

  /* ---------- utilities ---------- */

  private chooseHost() {
    if (this.room.hostId && this.room.participants.has(this.room.hostId)) {
      return;
    }
    const first = [...this.room.participants.values()][0];
    this.room.hostId = first?.id ?? null;
  }

  private broadcast() {
    for (const participant of this.room.participants.values()) {
      if (participant.socket.readyState !== SOCKET_OPEN) {
        continue;
      }

      const payload = {
        type: "room_state",
        state: {
          roomId: this.room.roomId,
          ticketTitle: this.room.ticketTitle,
          phase: this.room.phase,
          participants: [...this.room.participants.values()].map((p) => ({
            id: p.id,
            name: p.name,
            vote: p.vote,
            connected: true,
            isHost: p.id === this.room.hostId
          }))
        },
        selfId: participant.id
      };

      participant.socket.send(JSON.stringify(payload));
    }
  }

  /* ---------- WebSocket handling ---------- */

  private handleWebSocket(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    let participant: Participant | null = null;

    server.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") return;

      let msg: ClientMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "join_room") {
        participant = {
          id: randomId(),
          name: msg.name || "Anonymous",
          vote: null,
          socket: server
        };
        this.room.participants.set(participant.id, participant);
        if (msg.claimHost && !this.room.hostId) {
          this.room.hostId = participant.id;
        }
        this.chooseHost();
        this.broadcast();
        return;
      }

      if (!participant) return;

      switch (msg.type) {
        case "set_name":
          participant.name = msg.name || participant.name;
          break;

        case "set_ticket":
          if (participant.id !== this.room.hostId) return;
          this.room.ticketTitle = msg.ticketTitle || "";
          break;

        case "vote":
          this.room.phase = "voting";
          participant.vote = msg.vote || null;
          break;

        case "clear_vote":
          participant.vote = null;
          break;

        case "start_round":
          if (participant.id !== this.room.hostId) return;
          this.room.phase = "voting";
          for (const p of this.room.participants.values()) {
            p.vote = null;
          }
          break;

        case "reveal_votes":
          if (participant.id !== this.room.hostId) return;
          this.room.phase = "revealed";
          break;
      }

      this.broadcast();
    });

    server.addEventListener("close", () => {
      if (participant) {
        this.room.participants.delete(participant.id);
        this.chooseHost();
        this.broadcast();
      }
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    } as any);
  }

  /* ---------- entry ---------- */

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }

    // Simple room existence / creation API
    if (url.pathname.startsWith("/api/rooms/")) {
      const roomId = normalizeRoomId(url.pathname.split("/").pop() || "");
      if (!roomId) {
        return json({ error: "Missing room id" }, { status: 400 });
      }

      if (request.method === "PUT") {
        this.room.roomId = roomId;
        if (!this.room.hostId) {
          this.room.hostId = null;
        }
        return json({ exists: true, roomId });
      }

      return json({ exists: true, roomId });
    }

    return new Response("Not found", { status: 404 });
  }
}

/* =========================
  Worker router
========================= */

function getRoomIdFromRequest(request: Request) {
  const url = new URL(request.url);
  const explicitRoomId = url.searchParams.get("room") ?? url.searchParams.get("roomId") ?? "";
  if (explicitRoomId) {
    return normalizeRoomId(explicitRoomId);
  }

  const ref = request.headers.get("referer") ?? request.headers.get("Referer");
  if (!ref) return "";
  try {
    return normalizeRoomId(new URL(ref).searchParams.get("room") || "");
  } catch {
    return "";
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    /* ✅ WebSocket: forward ORIGINAL request */
    if (url.pathname === "/ws") {
      const roomId = getRoomIdFromRequest(request);
      if (!roomId) {
        return json({ error: "Missing room id" }, { status: 400 });
      }

      const id = env.ROOM_DO.idFromName(roomId);
      const stub = env.ROOM_DO.get(id);

      // ⭐ CRITICAL FIX — do NOT create new Request
      return stub.fetch(request);
    }

    /* API */
    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (url.pathname.startsWith("/api/rooms/")) {
      const roomId = normalizeRoomId(url.pathname.split("/").pop() || "");
      if (!roomId) {
        return json({ error: "Missing room id" }, { status: 400 });
      }
      const id = env.ROOM_DO.idFromName(roomId);
      return env.ROOM_DO.get(id).fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};