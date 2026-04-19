let cachedWorkerOrigin = "";

function getWorkerOrigin() {
  if (import.meta.env.DEV) {
    return "";
  }

  if (cachedWorkerOrigin) {
    return cachedWorkerOrigin;
  }

  const rawOrigin = import.meta.env.VITE_WORKER_ORIGIN?.trim();
  if (!rawOrigin) {
    throw new Error("Missing VITE_WORKER_ORIGIN for production API and WebSocket routing.");
  }
  cachedWorkerOrigin = new URL(rawOrigin).origin;
  return cachedWorkerOrigin;
}

function toWebSocketOrigin(origin: string) {
  return origin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}

export function buildApiUrl(pathname: string) {
  if (import.meta.env.DEV) {
    return `/api${pathname}`;
  }

  return new URL(`/api${pathname}`, getWorkerOrigin()).toString();
}

export function buildRoomWebSocketUrl(roomId: string) {
  if (import.meta.env.DEV) {
    const url = new URL("/ws", window.location.href);
    url.searchParams.set("room", roomId);
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return url.toString();
  }

  const url = new URL("/ws", toWebSocketOrigin(getWorkerOrigin()));
  url.searchParams.set("room", roomId);
  return url.toString();
}