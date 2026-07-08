/**
 * Mock WebSocket that fronts a {@link MockRoomServer} for the playground.
 *
 * `useRoomSocket` constructs `new WebSocket(url)` and drives the UI purely
 * through the standard `addEventListener` / `send` / `close` / `readyState`
 * surface. By overriding the global `WebSocket` with this class (only inside
 * the isolated `/playground.html` bundle) the real hook and `RoomScreen` run
 * unmodified against the in-memory server.
 *
 * Dev-only: `installMockRoomSocket` is called from the playground entry, never
 * from the application entry.
 */
import type { ClientMessage, ServerMessage } from '@agile-poker/app-core/poker';
import type { MockRoomServer, MockServerConnection } from './room-server';

type Listener = (event: { data?: string }) => void;

let activeServer: MockRoomServer | null = null;

class MockRoomWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readonly CONNECTING = 0;
	readonly OPEN = 1;
	readonly CLOSING = 2;
	readonly CLOSED = 3;

	readyState = MockRoomWebSocket.CONNECTING;

	private readonly listeners = new Map<string, Set<Listener>>();
	private readonly connection: MockServerConnection | null;

	constructor(_url: string) {
		this.connection =
			activeServer?.connect((frame: ServerMessage) => {
				this.dispatch('message', { data: JSON.stringify(frame) });
			}) ?? null;

		// Attach happens synchronously in the hook after construction; resolve the
		// connection on a microtask so listeners are registered first. With no
		// server installed there is nothing to talk to, so surface a failed
		// connection instead of opening into a dead socket (which would leave the
		// hook waiting on a `join_room` that never gets a reply).
		queueMicrotask(() => {
			if (this.readyState !== MockRoomWebSocket.CONNECTING) {
				return;
			}
			if (this.connection === null) {
				this.readyState = MockRoomWebSocket.CLOSED;
				this.dispatch('error', {});
				this.dispatch('close', {});
				return;
			}
			this.readyState = MockRoomWebSocket.OPEN;
			this.dispatch('open', {});
		});
	}

	addEventListener(type: string, listener: Listener): void {
		const set = this.listeners.get(type) ?? new Set<Listener>();
		set.add(listener);
		this.listeners.set(type, set);
	}

	removeEventListener(type: string, listener: Listener): void {
		this.listeners.get(type)?.delete(listener);
	}

	send(data: string): void {
		if (this.readyState !== MockRoomWebSocket.OPEN) {
			return;
		}
		const message = JSON.parse(data) as ClientMessage;
		this.connection?.send(message);
	}

	close(): void {
		if (this.readyState === MockRoomWebSocket.CLOSED) {
			return;
		}
		this.readyState = MockRoomWebSocket.CLOSED;
		this.connection?.close();
		this.dispatch('close', {});
	}

	private dispatch(type: string, event: { data?: string }): void {
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event);
		}
	}
}

/**
 * Point the mock socket at a server and override the global `WebSocket` (once).
 * Call again with a fresh server to swap scenarios; existing sockets keep their
 * original connection until they are closed and reconstructed.
 */
export function installMockRoomSocket(server: MockRoomServer): void {
	activeServer = server;
	const target = globalThis as { WebSocket?: unknown };
	if (target.WebSocket !== MockRoomWebSocket) {
		target.WebSocket = MockRoomWebSocket as unknown as typeof WebSocket;
	}
}
