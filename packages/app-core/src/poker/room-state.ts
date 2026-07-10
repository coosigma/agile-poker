import type {
	ClientMessage,
	Participant,
	RoomState,
	VoteChoice,
} from './types.js';
import type { ParticipantView, RoomStateView } from './types.js';

export function normalizeRoomId(roomId: string): string {
	return roomId.trim().toUpperCase();
}

export function normalizeParticipantName(name: string): string {
	return name.trim() || 'Anonymous';
}

export function createRoomState(roomId: string): RoomState {
	return {
		roomId,
		hostId: null,
		ticketTitle: '',
		phase: 'lobby',
		participants: [],
	};
}

/**
 * Produce a unique display name within the room. When the desired name is
 * already taken by another participant, a numeric suffix is appended.
 */
export function makeUniqueParticipantName(
	state: RoomState,
	desiredName: string,
	excludeParticipantId?: string,
): string {
	const normalizedName = normalizeParticipantName(desiredName);
	const takenNames = new Set(
		state.participants
			.filter((participant) => participant.id !== excludeParticipantId)
			.map((participant) => participant.name),
	);

	if (!takenNames.has(normalizedName)) {
		return normalizedName;
	}

	let suffix = 2;
	while (takenNames.has(`${normalizedName} ${suffix}`)) {
		suffix += 1;
	}

	return `${normalizedName} ${suffix}`;
}

/** Ensure a host is assigned: keep the current one if present, else the first. */
export function chooseHost(state: RoomState): RoomState {
	if (state.hostId && state.participants.some((p) => p.id === state.hostId)) {
		return state;
	}
	const nextHostId = state.participants[0]?.id ?? null;
	if (nextHostId === state.hostId) {
		return state;
	}
	return { ...state, hostId: nextHostId };
}

function replaceParticipant(
	state: RoomState,
	id: string,
	update: (participant: Participant) => Participant,
): RoomState {
	let changed = false;
	const participants = state.participants.map((participant) => {
		if (participant.id !== id) {
			return participant;
		}
		changed = true;
		return update(participant);
	});
	return changed ? { ...state, participants } : state;
}

export interface JoinRoomInput {
	readonly id: string;
	readonly name?: string;
	readonly claimHost?: boolean;
}

/** Add a participant to the room and (re)assign the host. */
export function joinRoom(state: RoomState, input: JoinRoomInput): RoomState {
	const name = makeUniqueParticipantName(state, input.name || 'Anonymous');
	const participant: Participant = { id: input.id, name, vote: null };

	let next: RoomState = {
		...state,
		participants: [...state.participants, participant],
	};

	if (input.claimHost && !next.hostId) {
		next = { ...next, hostId: participant.id };
	}

	return chooseHost(next);
}

export function setName(
	state: RoomState,
	id: string,
	name?: string,
): RoomState {
	const participant = state.participants.find((p) => p.id === id);
	if (!participant) {
		return state;
	}
	const uniqueName = makeUniqueParticipantName(
		state,
		name || participant.name,
		id,
	);
	return replaceParticipant(state, id, (p) => ({ ...p, name: uniqueName }));
}

/** Host-only: update the ticket title. Non-hosts leave the state unchanged. */
export function setTicket(
	state: RoomState,
	id: string,
	ticketTitle?: string,
): RoomState {
	if (id !== state.hostId) {
		return state;
	}
	return { ...state, ticketTitle: ticketTitle || '' };
}

/** Casting a vote moves the room into the voting phase. */
export function castVote(
	state: RoomState,
	id: string,
	vote?: VoteChoice,
): RoomState {
	if (!state.participants.some((p) => p.id === id)) {
		return state;
	}
	const withVote = replaceParticipant(state, id, (p) => ({
		...p,
		vote: vote ?? null,
	}));
	return { ...withVote, phase: 'voting' };
}

export function clearVote(state: RoomState, id: string): RoomState {
	return replaceParticipant(state, id, (p) => ({ ...p, vote: null }));
}

/** Host-only: start a new round, clearing every vote. */
export function startRound(state: RoomState, id: string): RoomState {
	if (id !== state.hostId) {
		return state;
	}
	return {
		...state,
		phase: 'voting',
		participants: state.participants.map((p) => ({ ...p, vote: null })),
	};
}

/** Host-only: reveal the votes. */
export function revealVotes(state: RoomState, id: string): RoomState {
	if (id !== state.hostId) {
		return state;
	}
	return { ...state, phase: 'revealed' };
}

/** Remove a participant (e.g. on disconnect) and reassign the host. */
export function leaveRoom(state: RoomState, id: string): RoomState {
	const participants = state.participants.filter((p) => p.id !== id);
	if (participants.length === state.participants.length) {
		return state;
	}
	return chooseHost({ ...state, participants });
}

/**
 * Pure reducer mapping a decoded `ClientMessage` to the next room state. It is
 * the single dispatch point over the individual transition functions, so the
 * transport adapter (and Effect use cases) never re-implement the switch.
 *
 * `participantId` is the sender's id; for `join_room` it is the freshly
 * allocated id the transport assigned to the new connection.
 */
export function applyClientMessage(
	state: RoomState,
	participantId: string,
	message: ClientMessage,
): RoomState {
	switch (message.type) {
		case 'join_room':
			return joinRoom(state, {
				id: participantId,
				name: message.name,
				claimHost: message.claimHost,
			});
		case 'set_name':
			return setName(state, participantId, message.name);
		case 'set_ticket':
			return setTicket(state, participantId, message.ticketTitle);
		case 'vote':
			return castVote(state, participantId, message.vote);
		case 'clear_vote':
			return clearVote(state, participantId);
		case 'start_round':
			return startRound(state, participantId);
		case 'reveal_votes':
			return revealVotes(state, participantId);
	}
}

/** Project the authoritative room state into the client-facing view. */
export function toRoomStateView(state: RoomState): RoomStateView {
	const participants: ParticipantView[] = state.participants.map(
		(participant) => ({
			id: participant.id,
			name: participant.name,
			vote: participant.vote,
			hasVoted: participant.vote !== null,
			connected: true,
			isHost: participant.id === state.hostId,
		}),
	);

	return {
		roomId: state.roomId,
		ticketTitle: state.ticketTitle,
		phase: state.phase,
		countdownValue: null,
		participants,
	};
}

export function redactRoomStateViewForParticipant(
	view: RoomStateView,
	participantId: string,
): RoomStateView {
	if (view.phase === 'revealed') {
		return view;
	}

	return {
		...view,
		participants: view.participants.map((participant) => ({
			...participant,
			vote: participant.id === participantId ? participant.vote : null,
		})),
	};
}
