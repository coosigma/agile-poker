type NumericCardValue = "0" | "1" | "2" | "3" | "5" | "8" | "13" | "21" | "34";
type SpecialCardValue = "?" | "☕";
type VoteModifier = "flat" | "base" | "sharp";
type RoomPhase = "lobby" | "countdown" | "voting" | "revealed";

type VoteChoice =
  | {
      kind: "estimate";
      base: NumericCardValue;
      modifier: VoteModifier;
    }
  | {
      kind: "special";
      value: SpecialCardValue;
    };

type ClientMessage =
  | { type: "join_room"; roomId?: string; name?: string; claimHost?: boolean }
  | { type: "set_name"; name?: string }
  | { type: "set_ticket"; ticketTitle?: string }
  | { type: "vote"; vote?: VoteChoice }
  | { type: "clear_vote" }
  | { type: "start_round" }
  | { type: "reveal_votes" };

interface WorkerWebSocket {
  accept(): void;
  send(message: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "message", listener: (event: { data: string }) => void): void;
  addEventListener(type: "close", listener: (event: Event) => void): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  readyState: number;
}

declare const WebSocketPair: {
  new (): { 0: WorkerWebSocket; 1: WorkerWebSocket };
};

interface Participant {
  id: string;
  name: string;
  vote: VoteChoice | null;
  connected: boolean;
  socket: WorkerWebSocket | null;
}

interface Room {
  roomId: string;
  hostId: string | null;
  ticketTitle: string;
  phase: RoomPhase;
  countdownValue: number | null;
  countdownTimers: ReturnType<typeof setTimeout>[];
  participants: Map<string, Participant>;
  updatedAt: number;
}

const SOCKET_OPEN = 1;
const rooms = new Map<string, Room>();

// Express concepts removed here:
// - app.listen / Node HTTP server
// - route registration through express().get()/put()
// Worker equivalent:
// - one export default fetch() handler
// - request pathname branching
// - WebSocketPair for /ws upgrades

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeRoomId(roomId: string) {
  return roomId.trim().toUpperCase();
}

function createRoomRecord(roomId: string) {
  const normalizedId = normalizeRoomId(roomId);
  const existing = rooms.get(normalizedId);
  if (existing) {
    return existing;
  }

  const room: Room = {
    roomId: normalizedId,
    hostId: null,
    ticketTitle: "",
    phase: "lobby",
    countdownValue: null,
    countdownTimers: [],
    participants: new Map(),
    updatedAt: Date.now()
  };
  rooms.set(normalizedId, room);
  return room;
}

function getRoom(roomId: string) {
  return rooms.get(normalizeRoomId(roomId)) ?? null;
}

function clearCountdown(room: Room) {
  for (const timer of room.countdownTimers) {
    clearTimeout(timer);
  }
  room.countdownTimers = [];
}

function markUpdated(room: Room) {
  room.updatedAt = Date.now();
}

function chooseNextHost(room: Room) {
  if (room.hostId) {
    const current = room.participants.get(room.hostId);
    if (current?.connected) {
      return;
    }
  }

  const next = [...room.participants.values()].find((participant) => participant.connected);
  room.hostId = next?.id ?? null;
}

function toSerializableRoom(room: Room) {
  chooseNextHost(room);
  return {
    roomId: room.roomId,
    ticketTitle: room.ticketTitle,
    phase: room.phase,
    countdownValue: room.countdownValue,
    participants: [...room.participants.values()]
      .map(({ socket: _socket, ...participant }) => ({
        ...participant,
        isHost: participant.id === room.hostId
      }))
      .sort((a, b) => Number(b.connected) - Number(a.connected) || Number(b.isHost) - Number(a.isHost) || a.name.localeCompare(b.name)),
    updatedAt: room.updatedAt
  };
}

function broadcastRoom(room: Room) {
  const state = toSerializableRoom(room);
  for (const participant of room.participants.values()) {
    if (participant.socket?.readyState === SOCKET_OPEN) {
      participant.socket.send(
        JSON.stringify({
          type: "room_state",
          state,
          selfId: participant.id
        })
      );
    }
  }
}

function cleanupRoom(room: Room) {
  const hasConnectedParticipant = [...room.participants.values()].some((participant) => participant.connected);
  if (!hasConnectedParticipant) {
    clearCountdown(room);
    rooms.delete(room.roomId);
  }
}

function isHost(room: Room, participant: Participant) {
  chooseNextHost(room);
  return room.hostId === participant.id;
}

function resetVotes(room: Room) {
  for (const participant of room.participants.values()) {
    participant.vote = null;
  }
}

function startVoting(room: Room) {
  clearCountdown(room);
  resetVotes(room);
  room.phase = "voting";
  room.countdownValue = null;
  markUpdated(room);
  broadcastRoom(room);
}

function startRevealCountdown(room: Room) {
  clearCountdown(room);
  room.phase = "countdown";
  room.countdownValue = 3;
  markUpdated(room);
  broadcastRoom(room);

  const steps = [2, 1];
  for (const [index, value] of steps.entries()) {
    room.countdownTimers.push(
      setTimeout(() => {
        room.countdownValue = value;
        markUpdated(room);
        broadcastRoom(room);
      }, (index + 1) * 600)
    );
  }

  room.countdownTimers.push(
    setTimeout(() => {
      room.phase = "revealed";
      room.countdownValue = null;
      markUpdated(room);
      broadcastRoom(room);
      clearCountdown(room);
    }, 1800)
  );
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

function textResponse(body: string, init?: ResponseInit) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

function createWebSocketResponse(request: Request) {
  if (request.headers.get("Upgrade") !== "websocket") {
    return textResponse("Expected WebSocket upgrade.", { status: 426, headers: { Upgrade: "websocket" } });
  }

  const pair = new WebSocketPair();
  const clientSocket = pair[0];
  const serverSocket = pair[1];
  serverSocket.accept();

  let currentRoom: Room | null = null;
  let currentParticipant: Participant | null = null;

  const sendError = (message: string) => {
    try {
      serverSocket.send(JSON.stringify({ type: "error", message }));
    } catch {
      // Socket may already be closed; keep the Worker request alive.
    }
  };

  serverSocket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") {
      sendError("消息格式不正确。");
      return;
    }

    let message: ClientMessage;

    try {
      message = JSON.parse(event.data) as ClientMessage;
    } catch {
      sendError("消息格式不正确。");
      return;
    }

    if (message.type === "join_room") {
      if (!message.roomId) {
        sendError("缺少房间号。");
        return;
      }

      const targetRoom = getRoom(message.roomId);
      if (!targetRoom) {
        sendError("房间不存在。");
        return;
      }

      currentRoom = targetRoom;
      const participantId = randomId();
      currentParticipant = {
        id: participantId,
        name: message.name?.trim() || "匿名成员",
        vote: null,
        connected: true,
        socket: serverSocket
      };

      currentRoom.participants.set(participantId, currentParticipant);
      if (message.claimHost && !currentRoom.hostId) {
        currentRoom.hostId = participantId;
      }

      chooseNextHost(currentRoom);
      markUpdated(currentRoom);
      broadcastRoom(currentRoom);
      return;
    }

    if (!currentRoom || !currentParticipant) {
      sendError("请先加入房间。");
      return;
    }

    switch (message.type) {
      case "set_name":
        currentParticipant.name = message.name?.trim() || "匿名成员";
        markUpdated(currentRoom);
        broadcastRoom(currentRoom);
        break;
      case "set_ticket":
        if (!isHost(currentRoom, currentParticipant)) {
          sendError("只有主持人可以编辑议题。");
          return;
        }
        currentRoom.ticketTitle = message.ticketTitle?.trim() || "";
        markUpdated(currentRoom);
        broadcastRoom(currentRoom);
        break;
      case "vote":
        if (currentRoom.phase !== "voting" && currentRoom.phase !== "revealed") {
          sendError("请等待主持人开启本轮投票。");
          return;
        }
        currentParticipant.vote = message.vote ?? null;
        if (currentRoom.phase === "revealed") {
          currentRoom.phase = "voting";
        }
        markUpdated(currentRoom);
        broadcastRoom(currentRoom);
        break;
      case "clear_vote":
        currentParticipant.vote = null;
        if (currentRoom.phase === "revealed") {
          currentRoom.phase = "voting";
        }
        markUpdated(currentRoom);
        broadcastRoom(currentRoom);
        break;
      case "start_round":
        if (!isHost(currentRoom, currentParticipant)) {
          sendError("只有主持人可以开启新一轮。");
          return;
        }
        startVoting(currentRoom);
        break;
      case "reveal_votes":
        if (!isHost(currentRoom, currentParticipant)) {
          sendError("只有主持人可以翻牌。");
          return;
        }
        if (![...currentRoom.participants.values()].some((participant) => participant.vote)) {
          sendError("至少有一位成员投票后才能翻牌。");
          return;
        }
        startRevealCountdown(currentRoom);
        break;
      default:
        sendError("不支持的消息类型。");
    }
  });

  serverSocket.addEventListener("close", () => {
    if (currentRoom && currentParticipant) {
      currentParticipant.connected = false;
      currentParticipant.socket = null;
      chooseNextHost(currentRoom);
      markUpdated(currentRoom);
      broadcastRoom(currentRoom);
      cleanupRoom(currentRoom);
    }
  });

  serverSocket.addEventListener("error", () => {
    console.warn("Worker WebSocket error occurred.");
  });

  return new Response(null, {
    status: 101,
    webSocket: clientSocket
  } as any);
}

async function handleApiRequest(request: Request, url: URL) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return jsonResponse({ ok: true });
  }

  if (url.pathname.startsWith("/api/rooms/")) {
    const roomId = decodeURIComponent(url.pathname.slice("/api/rooms/".length));
    if (!roomId) {
      return jsonResponse({ error: "Missing room id" }, { status: 400 });
    }

    if (request.method === "PUT") {
      const room = createRoomRecord(roomId);
      return jsonResponse({ ok: true, roomId: room.roomId });
    }

    if (request.method === "GET") {
      const room = getRoom(roomId);
      return jsonResponse({ exists: Boolean(room) });
    }

    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  return jsonResponse({ error: "Not found" }, { status: 404 });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return createWebSocketResponse(request);
    }

    return handleApiRequest(request, url);
  }
};