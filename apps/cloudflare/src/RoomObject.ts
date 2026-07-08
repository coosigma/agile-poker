import {
	createRoomState,
	normalizeRoomId,
	type RoomStateView,
} from '@agile-poker/app-core/poker';
import {
	applyMessage,
	decodeClientFrame,
	leave,
	makeRoomRuntime,
	setRoomId,
	type RoomRuntime,
} from '@agile-poker/app-core/poker/server';
import { Effect, Either } from 'effect';

const SOCKET_OPEN = 1;

function randomId(): string {
	return Math.random().toString(36).slice(2, 10);
}

/**
 * Room Durable Object.
 *
 * WebSocket handling lives entirely inside the Durable Object; the Worker only
 * routes the original request here. State transitions are delegated to pure
 * Effect use cases run through a per-room `ManagedRuntime` (see
 * `@agile-poker/app-core/poker/server`), so the DO stays a thin transport
 * adapter that decodes frames at the boundary and broadcasts the result.
 */
export class RoomDO implements DurableObject {
	private readonly runtime: RoomRuntime;
	private readonly sockets = new Map<string, WebSocket>();

	constructor(private readonly state: DurableObjectState) {
		this.runtime = makeRoomRuntime(createRoomState(this.state.id.toString()));
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/ws') {
			return this.handleWebSocket(request);
		}

		if (url.pathname.startsWith('/api/rooms/')) {
			const roomId = normalizeRoomId(url.pathname.split('/').pop() || '');
			if (!roomId) {
				return Response.json({ error: 'Missing room id' }, { status: 400 });
			}

			if (request.method === 'PUT') {
				const stored = await this.runtime.runPromise(setRoomId(roomId));
				return Response.json({ exists: true, roomId: stored });
			}

			return Response.json({ exists: true, roomId });
		}

		return new Response('Not found', { status: 404 });
	}

	private broadcast(view: RoomStateView): void {
		for (const [participantId, socket] of this.sockets) {
			if (socket.readyState !== SOCKET_OPEN) {
				continue;
			}
			socket.send(
				JSON.stringify({
					type: 'room_state',
					state: view,
					selfId: participantId,
				}),
			);
		}
	}

	private handleWebSocket(request: Request): Response {
		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('Expected WebSocket', { status: 426 });
		}

		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];

		server.accept();

		let participantId: string | null = null;

		server.addEventListener('message', async (event: MessageEvent) => {
			if (typeof event.data !== 'string') {
				return;
			}

			const decoded = await Effect.runPromise(
				Effect.either(decodeClientFrame(event.data)),
			);
			if (Either.isLeft(decoded)) {
				if (server.readyState === SOCKET_OPEN) {
					server.send(
						JSON.stringify({ type: 'error', message: decoded.left.reason }),
					);
				}
				return;
			}
			const message = decoded.right;

			if (message.type === 'join_room') {
				const id = randomId();
				participantId = id;
				this.sockets.set(id, server);
				const view = await this.runtime.runPromise(applyMessage(id, message));
				this.broadcast(view);
				return;
			}

			if (!participantId) {
				return;
			}

			const view = await this.runtime.runPromise(
				applyMessage(participantId, message),
			);
			this.broadcast(view);
		});

		server.addEventListener('close', async () => {
			if (participantId) {
				this.sockets.delete(participantId);
				const view = await this.runtime.runPromise(leave(participantId));
				this.broadcast(view);
			}
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
}
