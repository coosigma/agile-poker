/**
 * Minimal controllable WebSocket double for hook tests. It records outbound
 * frames and lets a test drive the connection lifecycle (open/message/error/
 * close) synchronously, so hook state transitions can be asserted without real
 * network timing.
 */
export interface MockServerFrame {
	readonly type: 'room_state' | 'error';
	readonly [key: string]: unknown;
}

type Listener = (event: unknown) => void;

export class MockWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	/** Every instance constructed, in order, so tests can grab the latest. */
	static instances: MockWebSocket[] = [];

	static reset(): void {
		MockWebSocket.instances = [];
	}

	static latest(): MockWebSocket {
		const socket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
		if (!socket) {
			throw new Error('No MockWebSocket has been constructed yet');
		}
		return socket;
	}

	readonly url: string;
	readyState: number = MockWebSocket.CONNECTING;
	readonly sent: string[] = [];
	closed = false;
	private readonly listeners = new Map<string, Set<Listener>>();

	constructor(url: string) {
		this.url = url;
		MockWebSocket.instances.push(this);
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
		this.sent.push(data);
	}

	close(): void {
		this.closed = true;
		this.readyState = MockWebSocket.CLOSED;
		this.emit('close', {});
	}

	private emit(type: string, event: unknown): void {
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event);
		}
	}

	// --- test drivers -------------------------------------------------------

	emitOpen(): void {
		this.readyState = MockWebSocket.OPEN;
		this.emit('open', {});
	}

	emitMessage(frame: MockServerFrame): void {
		this.emit('message', { data: JSON.stringify(frame) });
	}

	emitError(): void {
		this.emit('error', {});
	}

	/** The parsed payloads this client has sent to the server. */
	sentPayloads(): unknown[] {
		return this.sent.map((raw) => JSON.parse(raw));
	}
}
