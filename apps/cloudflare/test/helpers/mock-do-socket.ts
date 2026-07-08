/**
 * Integration-level socket doubles for driving the room Durable Object inside a
 * plain Node/vitest process — no wrangler, no real network.
 *
 * `RoomDO` only needs three Workers-platform primitives to run its message and
 * lifecycle logic: a `WebSocketPair` factory, an event-capable socket
 * (`accept`/`send`/`addEventListener`), and a 101 handshake `Response` (which
 * Node's undici refuses to construct). None of these carry the behaviour under
 * test — they are pure transport plumbing — so doubling them lets the DO's
 * decode -> apply -> broadcast -> leave logic be asserted deterministically at
 * the integration layer, exactly like the frontend hook test doubles WebSocket.
 */

export class MockServerSocket {
	readyState = 1;
	/** Every JSON frame the DO pushed to this socket, in order. */
	readonly sent: string[] = [];
	private readonly listeners: Record<string, ((event: unknown) => void)[]> = {};

	accept(): void {}

	send(data: string): void {
		this.sent.push(data);
	}

	addEventListener(type: string, handler: (event: unknown) => void): void {
		(this.listeners[type] ??= []).push(handler);
	}

	/** Drive a message frame as the client would, awaiting async handlers. */
	async message(data: string): Promise<void> {
		await this.emit('message', { data });
	}

	/** Drive a socket close, awaiting the DO's leave/broadcast handler. */
	async close(): Promise<void> {
		this.readyState = 3;
		await this.emit('close', {});
	}

	private async emit(type: string, event: unknown): Promise<void> {
		for (const handler of this.listeners[type] ?? []) {
			await handler(event);
		}
	}

	/** Parsed view of every frame received, for assertions. */
	frames(): { type: string; [key: string]: unknown }[] {
		return this.sent.map((raw) => JSON.parse(raw));
	}

	lastFrame(): { type: string; [key: string]: unknown } | undefined {
		const raw = this.sent[this.sent.length - 1];
		return raw ? JSON.parse(raw) : undefined;
	}
}

/**
 * Installs the platform globals `RoomDO` relies on and returns a handle that
 * captures the server socket created by each `WebSocketPair()` call, so a test
 * can grab the socket the DO wired its listeners onto after calling `fetch`.
 */
export function installPlatformDoubles(): {
	nextServerSocket(): MockServerSocket;
	restore(): void;
} {
	const created: MockServerSocket[] = [];
	const realResponse = globalThis.Response;

	(globalThis as Record<string, unknown>).WebSocketPair =
		function WebSocketPair() {
			const client = new MockServerSocket();
			const server = new MockServerSocket();
			created.push(server);
			return { 0: client, 1: server } as unknown;
		};

	// Node's undici throws for status 101; the handshake Response is never
	// inspected by the tests, so return a lightweight stand-in for that case.
	(globalThis as Record<string, unknown>).Response = new Proxy(realResponse, {
		construct(target, args: [BodyInit | null, ResponseInit?]) {
			const init = args[1];
			if (init?.status === 101) {
				return { status: 101 } as unknown as Response;
			}
			return Reflect.construct(target, args);
		},
	});

	let cursor = 0;
	return {
		nextServerSocket(): MockServerSocket {
			const socket = created[cursor];
			cursor += 1;
			if (!socket) {
				throw new Error(
					'No server socket was created; call room.fetch(wsRequest) first',
				);
			}
			return socket;
		},
		restore(): void {
			delete (globalThis as Record<string, unknown>).WebSocketPair;
			(globalThis as Record<string, unknown>).Response = realResponse;
		},
	};
}

/** A WebSocket upgrade request for the room's `/ws` endpoint. */
export function wsUpgradeRequest(): Request {
	return new Request('http://do/ws', { headers: { Upgrade: 'websocket' } });
}

/** A minimal DurableObjectState double — `RoomDO` only reads `id.toString()`. */
export function fakeDurableObjectState(id: string): unknown {
	return { id: { toString: () => id } };
}
