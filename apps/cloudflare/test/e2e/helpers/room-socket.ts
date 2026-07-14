/**
 * Test-side WebSocket client for the room Durable Object.
 *
 * These end-to-end tests talk to the real Worker (wrangler dev locally, or the
 * deployed worker when `APP_URL` is set), so they exercise the actual transport,
 * boundary decoding, per-room Effect runtime, and broadcast fan-out — not a
 * mock. Frames are buffered and awaited via predicates so assertions are
 * deterministic instead of timing-dependent.
 */

export interface RoomStateView {
	readonly roomId: string;
	readonly roomState: 'empty' | 'active';
	readonly votingState:
		'noTopic' | 'ready' | 'voting' | 'countdown' | 'revealed' | 'completed';
	readonly revealCountdownEndsAt: number | null;
	readonly ticketTitle: string;
	readonly participants: readonly {
		readonly id: string;
		readonly name: string;
		readonly vote: unknown;
		readonly hasVoted: boolean;
		readonly connected: boolean;
		readonly isHost: boolean;
	}[];
}

export type ServerFrame =
	| {
			readonly type: 'room_state';
			readonly state: RoomStateView;
			readonly selfId: string;
	  }
	| { readonly type: 'error'; readonly message: string };

/** Resolve the `ws(s)://.../ws` base from `APP_URL`, defaulting to wrangler dev. */
export function roomSocketUrl(roomId: string): string {
	const appUrl = process.env.APP_URL;
	const base = appUrl
		? appUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
		: 'ws://localhost:8787';
	const url = new URL('/ws', base);
	url.searchParams.set('room', roomId);
	return url.toString();
}

export interface RoomClient {
	readonly frames: ServerFrame[];
	send(payload: unknown): void;
	/** Send a raw text frame verbatim, bypassing JSON encoding. */
	sendRaw(text: string): void;
	waitFor(
		predicate: (frame: ServerFrame) => boolean,
		label?: string,
	): Promise<ServerFrame>;
	last(): ServerFrame | undefined;
	close(): Promise<void>;
}

export async function connectRoom(roomId: string): Promise<RoomClient> {
	const ws = new WebSocket(roomSocketUrl(roomId));
	const frames: ServerFrame[] = [];
	const waiters: {
		predicate: (f: ServerFrame) => boolean;
		resolve: (f: ServerFrame) => void;
	}[] = [];

	ws.addEventListener('message', (event: MessageEvent) => {
		if (typeof event.data !== 'string') {
			return;
		}
		const frame = JSON.parse(event.data) as ServerFrame;
		frames.push(frame);
		const idx = waiters.findIndex((w) => w.predicate(frame));
		if (idx !== -1) {
			waiters.splice(idx, 1)[0].resolve(frame);
		}
	});

	await new Promise<void>((resolve, reject) => {
		ws.addEventListener('open', () => resolve(), { once: true });
		ws.addEventListener(
			'error',
			() => reject(new Error(`WebSocket failed for room ${roomId}`)),
			{
				once: true,
			},
		);
	});

	return {
		frames,
		send(payload: unknown) {
			ws.send(JSON.stringify(payload));
		},
		sendRaw(text: string) {
			ws.send(text);
		},
		waitFor(predicate, label) {
			const existing = frames.find(predicate);
			if (existing) {
				return Promise.resolve(existing);
			}
			return new Promise<ServerFrame>((resolve, reject) => {
				const timer = setTimeout(() => {
					reject(
						new Error(`Timed out waiting for frame: ${label ?? 'predicate'}`),
					);
				}, 5000);
				waiters.push({
					predicate,
					resolve: (f) => {
						clearTimeout(timer);
						resolve(f);
					},
				});
			});
		},
		last() {
			return frames[frames.length - 1];
		},
		close() {
			return new Promise<void>((resolve) => {
				if (ws.readyState === WebSocket.CLOSED) {
					resolve();
					return;
				}
				ws.addEventListener('close', () => resolve(), { once: true });
				ws.close();
			});
		},
	};
}

export function roomStateOf(frame: ServerFrame | undefined): RoomStateView {
	if (!frame || frame.type !== 'room_state') {
		throw new Error('Expected a room_state frame');
	}
	return frame.state;
}

/** Unique room id per test so each maps to a fresh Durable Object instance. */
export function uniqueRoomId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2, 6)}`.toUpperCase();
}
