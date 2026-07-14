import type {
	ClientMessage,
	CompletedRound,
	Participant,
	ParticipantRole,
	RoomState,
	VoteChoice,
} from './types.js';
import type { ParticipantView, RoomStateView } from './types.js';
import { transitionRoomState } from './room-machine.js';
import { transitionVotingState } from './voting-machine.js';

export const MAX_COMPLETED_ROUNDS = 20;
export const REVEAL_COUNTDOWN_MS = 3000;

export function normalizeRoomId(roomId: string): string {
	return roomId.trim().toUpperCase();
}

export function normalizeParticipantName(name: string): string {
	return name.trim() || 'Anonymous';
}

export function createRoomState(roomId: string): RoomState {
	return {
		roomId,
		roomState: 'empty',
		votingState: 'noTopic',
		revealCountdownEndsAt: null,
		hostId: null,
		ticketTitle: '',
		participants: [],
		completedRounds: [],
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
	readonly role?: ParticipantRole;
}

/** Add a participant to the room and (re)assign the host. */
export function joinRoom(state: RoomState, input: JoinRoomInput): RoomState {
	const name = makeUniqueParticipantName(state, input.name || 'Anonymous');
	const role = input.role ?? (input.claimHost ? 'observer' : 'player');
	const participant: Participant = { id: input.id, name, role, vote: null };

	let next: RoomState = {
		...state,
		roomState: transitionRoomState(state.roomState, { type: 'JOIN' }),
		participants: [...state.participants, participant],
	};

	if (input.claimHost && !next.hostId) {
		next = { ...next, hostId: participant.id };
	}

	return chooseHost(next);
}

export function setRole(
	state: RoomState,
	id: string,
	role: ParticipantRole,
	participantId?: string,
): RoomState {
	const targetId = id === state.hostId ? (participantId ?? id) : id;
	if (!state.participants.some((participant) => participant.id === targetId)) {
		return state;
	}
	return replaceParticipant(state, targetId, (participant) => ({
		...participant,
		role,
		vote: role === 'observer' ? null : participant.vote,
	}));
}

export function transferHost(
	state: RoomState,
	id: string,
	participantId: string,
): RoomState {
	if (id !== state.hostId) {
		return state;
	}
	if (
		participantId === state.hostId ||
		!state.participants.some((participant) => participant.id === participantId)
	) {
		return state;
	}
	return { ...state, hostId: participantId };
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
	if (
		state.votingState !== 'noTopic' &&
		state.votingState !== 'ready' &&
		state.votingState !== 'completed'
	) {
		return state;
	}
	const nextTitle = ticketTitle || '';
	const nextVotingState = transitionVotingState(state.votingState, {
		type: nextTitle ? 'SET_TOPIC' : 'CLEAR_TOPIC',
	});
	return {
		...state,
		ticketTitle: nextTitle,
		votingState: nextVotingState,
		revealCountdownEndsAt: null,
	};
}

/** Casting a vote is valid while voting is open or the reveal countdown runs. */
export function castVote(
	state: RoomState,
	id: string,
	vote?: VoteChoice,
): RoomState {
	if (!state.participants.some((p) => p.id === id)) {
		return state;
	}
	if (state.participants.find((p) => p.id === id)?.role !== 'player') {
		return state;
	}
	const nextVotingState = transitionVotingState(state.votingState, {
		type: 'VOTE',
	});
	if (
		nextVotingState === state.votingState &&
		state.votingState !== 'voting' &&
		state.votingState !== 'countdown'
	) {
		return state;
	}
	const withVote = replaceParticipant(state, id, (p) => ({
		...p,
		vote: vote ?? null,
	}));
	return { ...withVote, votingState: nextVotingState };
}

export function clearVote(state: RoomState, id: string): RoomState {
	if (state.votingState !== 'voting') {
		return state;
	}
	return replaceParticipant(state, id, (p) => ({ ...p, vote: null }));
}

/** Host-only: start a new round, clearing every vote. */
export function startRound(state: RoomState, id: string): RoomState {
	if (id !== state.hostId) {
		return state;
	}
	const event =
		state.votingState === 'ready'
			? { type: 'START' as const }
			: { type: 'RESET' as const };
	const nextVotingState = transitionVotingState(state.votingState, event);
	if (nextVotingState === state.votingState && state.votingState !== 'voting') {
		return state;
	}
	return {
		...state,
		votingState: nextVotingState,
		revealCountdownEndsAt: null,
		participants: state.participants.map((p) => ({ ...p, vote: null })),
	};
}

/** Host-only: start the reveal countdown. */
export function revealVotes(state: RoomState, id: string): RoomState {
	if (id !== state.hostId) {
		return state;
	}
	const nextVotingState = transitionVotingState(state.votingState, {
		type: 'REVEAL',
	});
	return nextVotingState === state.votingState
		? state
		: {
				...state,
				votingState: nextVotingState,
				revealCountdownEndsAt: Date.now() + REVEAL_COUNTDOWN_MS,
			};
}

/** Complete an active reveal countdown and expose all votes. */
export function completeRevealCountdown(state: RoomState): RoomState {
	const nextVotingState = transitionVotingState(state.votingState, {
		type: 'COUNTDOWN_DONE',
	});
	return nextVotingState === state.votingState
		? state
		: {
				...state,
				votingState: nextVotingState,
				revealCountdownEndsAt: null,
			};
}

function completeCurrentRound(state: RoomState): CompletedRound | null {
	if (!state.ticketTitle.trim()) {
		return null;
	}
	const votes = state.participants.flatMap((participant) =>
		participant.role !== 'player' || participant.vote === null
			? []
			: [
					{
						participantId: participant.id,
						participantName: participant.name,
						vote: participant.vote,
					},
				],
	);
	if (votes.length === 0) {
		return null;
	}
	return { ticketTitle: state.ticketTitle, votes };
}

/** Host-only: complete the current revealed topic and archive its result. */
export function doneTicket(state: RoomState, id: string): RoomState {
	if (id !== state.hostId) {
		return state;
	}
	const nextVotingState = transitionVotingState(state.votingState, {
		type: 'DONE',
	});
	if (nextVotingState === state.votingState) {
		return state;
	}
	const completedRound = completeCurrentRound(state);
	return {
		...state,
		votingState: nextVotingState,
		revealCountdownEndsAt: null,
		ticketTitle: '',
		participants: state.participants.map((p) => ({ ...p, vote: null })),
		completedRounds: completedRound
			? [...state.completedRounds, completedRound].slice(-MAX_COMPLETED_ROUNDS)
			: state.completedRounds,
	};
}

/** Remove a participant (e.g. on disconnect) and reassign the host. */
export function leaveRoom(state: RoomState, id: string): RoomState {
	const participants = state.participants.filter((p) => p.id !== id);
	if (participants.length === state.participants.length) {
		return state;
	}
	const nextRoomState = transitionRoomState(state.roomState, {
		type: participants.length === 0 ? 'ROOM_EMPTIED' : 'LEAVE',
	});
	return chooseHost({ ...state, roomState: nextRoomState, participants });
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
				role: message.role,
			});
		case 'set_name':
			return setName(state, participantId, message.name);
		case 'set_role':
			return setRole(state, participantId, message.role, message.participantId);
		case 'transfer_host':
			return transferHost(state, participantId, message.participantId);
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
		case 'done_ticket':
			return doneTicket(state, participantId);
	}
}

/** Project the authoritative room state into the client-facing view. */
export function toRoomStateView(state: RoomState): RoomStateView {
	const participants: ParticipantView[] = state.participants.map(
		(participant) => ({
			id: participant.id,
			name: participant.name,
			role: participant.role,
			vote: participant.vote,
			hasVoted: participant.vote !== null,
			connected: true,
			isHost: participant.id === state.hostId,
		}),
	);

	return {
		roomId: state.roomId,
		roomState: state.roomState,
		votingState: state.votingState,
		revealCountdownEndsAt: state.revealCountdownEndsAt,
		ticketTitle: state.ticketTitle,
		participants,
		completedRounds: state.completedRounds,
	};
}

export function redactRoomStateViewForParticipant(
	view: RoomStateView,
	participantId: string,
): RoomStateView {
	if (view.votingState === 'revealed') {
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
