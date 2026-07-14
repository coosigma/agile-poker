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
	completeRevealCountdown,
	createRoomState,
	leaveRoom,
	redactRoomStateViewForParticipant,
	toRoomStateView,
	type ClientMessage,
	type RoomState,
	type ServerMessage,
	type VoteChoice,
} from '@agile-poker/app-core/poker';

type Emit = (frame: ServerMessage) => void;
type StateListener = () => void;

export interface MockServerConnection {
	send(message: ClientMessage): void;
	close(): void;
}

export interface SimulatedPlayer {
	readonly id: string;
	readonly name: string;
	readonly vote: VoteChoice | null;
}

/** Estimates a simulated player casts when it joins an active voting round. */
const SIM_VOTE_BASES = ['1', '2', '3', '5', '8', '13'] as const;

export class MockRoomServer {
	private state: RoomState;
	private readonly live = new Map<string, Emit>();
	private readonly listeners = new Set<StateListener>();
	private counter = 0;
	private readonly sims = new Map<string, string>();
	private simCounter = 0;
	private revealCountdownTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(roomId: string) {
		this.state = createRoomState(roomId);
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
		this.applyMessage(id, {
			type: 'join_room',
			roomId: this.state.roomId,
			name: displayName,
			claimHost: false,
		});
		if (this.state.votingState === 'voting') {
			const base =
				SIM_VOTE_BASES[(this.simCounter - 1) % SIM_VOTE_BASES.length];
			this.applyMessage(id, {
				type: 'vote',
				vote: { kind: 'estimate', base, modifier: 'flat' },
			});
		}
		this.sims.set(id, displayName);
		this.broadcast();
		return this.simulatedPlayer(id, displayName, this.voteByParticipantId());
	}

	voteAsSimulatedPlayer(id: string, vote: VoteChoice): void {
		if (!this.sims.has(id)) {
			return;
		}
		this.applyMessage(id, { type: 'vote', vote });
		this.broadcast();
	}

	clearSimulatedPlayerVote(id: string): void {
		if (!this.sims.has(id)) {
			return;
		}
		this.applyMessage(id, { type: 'clear_vote' });
		this.broadcast();
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
		const votes = this.voteByParticipantId();
		return [...this.sims].map(([id, name]) =>
			this.simulatedPlayer(id, name, votes),
		);
	}

	subscribe(listener: StateListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private voteByParticipantId(): Map<string, VoteChoice | null> {
		return new Map(
			this.state.participants.map((participant) => [
				participant.id,
				participant.vote,
			]),
		);
	}

	private simulatedPlayer(
		id: string,
		name: string,
		votes: ReadonlyMap<string, VoteChoice | null>,
	): SimulatedPlayer {
		return {
			id,
			name,
			vote: votes.get(id) ?? null,
		};
	}

	/**
	 * Apply a message from a pre-existing (seeded) participant that has no live
	 * socket. Used by scenarios to stage other people, votes and voting state before the
	 * previewed client connects.
	 */
	seed(participantId: string, message: ClientMessage): void {
		this.applyMessage(participantId, message, { completeCountdown: true });
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
				this.applyMessage(participantId, message);
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
		for (const listener of this.listeners) {
			listener();
		}
	}

	private applyMessage(
		participantId: string,
		message: ClientMessage,
		options: { readonly completeCountdown?: boolean } = {},
	): void {
		this.state = applyClientMessage(this.state, participantId, message);
		if (this.state.votingState !== 'countdown') {
			this.clearRevealCountdownTimer();
			return;
		}
		if (options.completeCountdown) {
			this.state = completeRevealCountdown(this.state);
			this.clearRevealCountdownTimer();
			return;
		}
		this.scheduleRevealCountdown();
	}

	private clearRevealCountdownTimer(): void {
		if (!this.revealCountdownTimer) {
			return;
		}
		clearTimeout(this.revealCountdownTimer);
		this.revealCountdownTimer = null;
	}

	private scheduleRevealCountdown(): void {
		if (
			this.state.votingState !== 'countdown' ||
			this.state.revealCountdownEndsAt === null
		) {
			this.clearRevealCountdownTimer();
			return;
		}
		if (this.revealCountdownTimer) {
			clearTimeout(this.revealCountdownTimer);
		}
		this.revealCountdownTimer = setTimeout(
			() => {
				this.revealCountdownTimer = null;
				const next = completeRevealCountdown(this.state);
				if (next === this.state) {
					return;
				}
				this.state = next;
				this.broadcast();
			},
			Math.max(0, this.state.revealCountdownEndsAt - Date.now()),
		);
	}
}
