import express from "express";
import http from "node:http";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";

type NumericCardValue = "0" | "1/2" | "1" | "2" | "3" | "5" | "8" | "13" | "21" | "34";
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

interface Participant {
  id: string;
  name: string;
  vote: VoteChoice | null;
  connected: boolean;
  socket: WebSocket | null;
}

interface Room {
  roomId: string;
  hostId: string | null;
  ticketTitle: string;
  phase: RoomPhase;
  countdownValue: number | null;
  countdownTimers: NodeJS.Timeout[];
  participants: Map<string, Participant>;
  updatedAt: number;
}

const PORT = Number(process.env.PORT ?? 8787);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const rooms = new Map<string, Room>();

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
    if (participant.socket?.readyState === WebSocket.OPEN) {
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

function startCountdown(room: Room) {
  clearCountdown(room);
  resetVotes(room);
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
      room.phase = "voting";
      room.countdownValue = null;
      markUpdated(room);
      broadcastRoom(room);
      clearCountdown(room);
    }, 1800)
  );
}

app.use(express.json());

app.put("/api/rooms/:roomId", (request, response) => {
  const room = createRoomRecord(request.params.roomId);
  response.json({ ok: true, roomId: room.roomId });
});

app.get("/api/rooms/:roomId", (request, response) => {
  const room = getRoom(request.params.roomId);
  response.json({ exists: Boolean(room) });
});

if (process.env.NODE_ENV === "production") {
  const clientPath = path.resolve(process.cwd(), "dist");
  app.use(express.static(clientPath));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientPath, "index.html"));
  });
} else {
  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });
}

wss.on("connection", (socket) => {
  let currentRoom: Room | null = null;
  let currentParticipant: Participant | null = null;

  const sendError = (message: string) => {
    socket.send(JSON.stringify({ type: "error", message }));
  };

  socket.on("message", (rawData) => {
    let message: ClientMessage;

    try {
      message = JSON.parse(rawData.toString()) as ClientMessage;
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
        socket
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
        startCountdown(currentRoom);
        break;
      case "reveal_votes":
        if (!isHost(currentRoom, currentParticipant)) {
          sendError("只有主持人可以翻牌。");
          return;
        }
        currentRoom.phase = "revealed";
        currentRoom.countdownValue = null;
        clearCountdown(currentRoom);
        markUpdated(currentRoom);
        broadcastRoom(currentRoom);
        break;
      default:
        sendError("不支持的消息类型。");
    }
  });

  socket.on("close", () => {
    if (currentRoom && currentParticipant) {
      currentParticipant.connected = false;
      currentParticipant.socket = null;
      chooseNextHost(currentRoom);
      markUpdated(currentRoom);
      broadcastRoom(currentRoom);
      cleanupRoom(currentRoom);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Agile Poker server listening on http://localhost:${PORT}`);
});
