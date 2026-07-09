/**
 * In-memory mock room server for the playground.
 *
 * It reuses the **real** pure domain reducer from
 * `@agile-poker/app-core/poker` — the exact same `applyClientMessage` /
 * `toRoomStateView` / `leaveRoom` the Durable Object runs — so previewed room
 * states are authoritative and never drift from production behaviour. Nothing
 * here re-implements room logic; it only plays the transport role the Durable
 * Object plays (allocate ids, broadcast the projected view), minus the network.
 *
 * This is dev-only tooling: it powers the `/playground.html` preview entry and
 * is never bundled into the application (`index.html`) path.
 */
import {
	applyClientMessage,
	createRoomState,
	leaveRoom,
	redactRoomStateViewForParticipant,
	toRoomStateView,
	type ClientMessage,
	type RoomState,
	type ServerMessage,
} from '@agile-poker/app-core/poker';

type Emit = (frame: ServerMessage) => void;

export interface MockServerConnection {
	send(message: ClientMessage): void;
	close(): void;
}

export interface SimulatedPlayer {
	readonly id: string;
	readonly name: string;
}

/** Estimates a simulated player casts when it joins an active voting round. */
const SIM_VOTE_BASES = ['1', '2', '3', '5', '8', '13'] as const;

export class MockRoomServer {
	private state: RoomState;
	private readonly live = new Map<string, Emit>();
	private counter = 0;
	private readonly sims = new Map<string, string>();
	private simCounter = 0;

	constructor(roomId: string) {
		this.state = createRoomState(roomId);
	}

	/** Current room phase, so the playground can label controls contextually. */
	get phase(): RoomState['phase'] {
		return this.state.phase;
	}

	/**
	 * Add a simulated participant at runtime (as if another person joined over a
	 * live socket) and broadcast the new seating to connected clients. When a
	 * voting round is underway the newcomer also casts an estimate so its seat
	 * card renders filled content.
	 */
	addSimulatedPlayer(name?: string): SimulatedPlayer {
		this.simCounter += 1;
		const id = `sim-${this.simCounter}`;
		const displayName = name?.trim() || `Sim ${this.simCounter}`;
		this.state = applyClientMessage(this.state, id, {
			type: 'join_room',
			roomId: this.state.roomId,
			name: displayName,
			claimHost: false,
		});
		if (this.state.phase === 'voting') {
			const base =
				SIM_VOTE_BASES[(this.simCounter - 1) % SIM_VOTE_BASES.length];
			this.state = applyClientMessage(this.state, id, {
				type: 'vote',
				vote: { kind: 'estimate', base, modifier: 'flat' },
			});
		}
		this.sims.set(id, displayName);
		this.broadcast();
		return { id, name: displayName };
	}

	/** Remove a previously simulated participant and broadcast the update. */
	removeSimulatedPlayer(id: string): void {
		if (!this.sims.delete(id)) {
			return;
		}
		this.state = leaveRoom(this.state, id);
		this.broadcast();
	}

	/** Remove every simulated participant in one step. */
	clearSimulatedPlayers(): void {
		if (this.sims.size === 0) {
			return;
		}
		for (const id of this.sims.keys()) {
			this.state = leaveRoom(this.state, id);
		}
		this.sims.clear();
		this.broadcast();
	}

	/** Snapshot of the simulated participants this server currently holds. */
	simulatedPlayers(): SimulatedPlayer[] {
		return [...this.sims].map(([id, name]) => ({ id, name }));
	}

	/**
	 * Apply a message from a pre-existing (seeded) participant that has no live
	 * socket. Used by scenarios to stage other people, votes and phase before the
	 * previewed client connects.
	 */
	seed(participantId: string, message: ClientMessage): void {
		this.state = applyClientMessage(this.state, participantId, message);
	}

	/** Register a live client. The returned handle mirrors a socket lifecycle. */
	connect(emit: Emit): MockServerConnection {
		let participantId: string | null = null;

		return {
			send: (message: ClientMessage) => {
				if (message.type === 'join_room' && participantId === null) {
					this.counter += 1;
					participantId = `you-${this.counter}`;
					this.live.set(participantId, emit);
				}
				if (participantId === null) {
					return;
				}
				this.state = applyClientMessage(this.state, participantId, message);
				this.broadcast();
			},
			close: () => {
				if (participantId === null) {
					return;
				}
				this.live.delete(participantId);
				this.state = leaveRoom(this.state, participantId);
				participantId = null;
				this.broadcast();
			},
		};
	}

	private broadcast(): void {
		const view = toRoomStateView(this.state);
		for (const [id, emit] of this.live) {
			emit({
				type: 'room_state',
				state: redactRoomStateViewForParticipant(view, id),
				selfId: id,
			});
		}
	}
}
