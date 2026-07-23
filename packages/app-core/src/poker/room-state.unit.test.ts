import { describe, expect, test } from 'vitest';
import {
	castVote,
	clearVote,
	completeRevealCountdown,
	createRoomState,
	doneTicket,
	joinRoom,
	leaveRoom,
	MAX_COMPLETED_ROUNDS,
	makeUniqueParticipantName,
	normalizeParticipantName,
	normalizeRoomId,
	normalizeRoomName,
	redactRoomStateViewForParticipant,
	revealVotes,
	setName,
	setRole,
	setTicket,
	startRound,
	toRoomStateView,
	transferHost,
} from './room-state.js';
import type { RoomState, VoteChoice } from './types.js';

const ESTIMATE: VoteChoice = { kind: 'estimate', base: '5', modifier: 'base' };

function room(): RoomState {
	return createRoomState('ROOM1');
}

describe('normalizeRoomId', () => {
	test('trims and upper-cases', () => {
		expect(normalizeRoomId('  ab12  ')).toBe('AB12');
	});
});

describe('normalizeParticipantName', () => {
	test('trims and falls back to Anonymous', () => {
		expect(normalizeParticipantName('  Alice ')).toBe('Alice');
		expect(normalizeParticipantName('   ')).toBe('Anonymous');
	});
});

describe('normalizeRoomName', () => {
	test('trims surrounding whitespace', () => {
		expect(normalizeRoomName('  Sprint 42 planning  ')).toBe(
			'Sprint 42 planning',
		);
	});

	test('truncates to 60 characters', () => {
		const long = 'x'.repeat(80);
		expect(normalizeRoomName(long)).toBe('x'.repeat(60));
	});

	test('returns an empty string when given only whitespace', () => {
		expect(normalizeRoomName('   ')).toBe('');
	});
});

describe('makeUniqueParticipantName', () => {
	test('appends a numeric suffix when the name is taken', () => {
		let state = room();
		state = joinRoom(state, { id: 'p1', name: 'Alice' });
		expect(makeUniqueParticipantName(state, 'Alice')).toBe('Alice 2');
	});

	test('ignores the excluded participant when checking collisions', () => {
		let state = room();
		state = joinRoom(state, { id: 'p1', name: 'Alice' });
		expect(makeUniqueParticipantName(state, 'Alice', 'p1')).toBe('Alice');
	});
});

describe('joinRoom', () => {
	test('assigns the first participant as host', () => {
		let state = room();
		state = joinRoom(state, { id: 'p1', name: 'Alice' });
		expect(state.hostId).toBe('p1');
		expect(state.participants).toHaveLength(1);
	});

	test('keeps the original host when a second participant joins', () => {
		let state = room();
		state = joinRoom(state, { id: 'p1', name: 'Alice' });
		state = joinRoom(state, { id: 'p2', name: 'Bob' });
		expect(state.hostId).toBe('p1');
	});

	test('gives duplicate names a numeric suffix', () => {
		let state = room();
		state = joinRoom(state, { id: 'p1', name: 'Alice' });
		state = joinRoom(state, { id: 'p2', name: 'Alice' });
		expect(state.participants.map((p) => p.name)).toEqual(['Alice', 'Alice 2']);
	});

	test('defaults claimed hosts to observer and regular joins to player', () => {
		let state = room();
		state = joinRoom(state, { id: 'host', name: 'Host', claimHost: true });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });

		expect(state.participants).toMatchObject([
			{ id: 'host', role: 'observer' },
			{ id: 'guest', role: 'player' },
		]);
	});

	test('sets and normalizes the room name from the first join that provides one', () => {
		let state = room();
		state = joinRoom(state, {
			id: 'host',
			name: 'Host',
			roomName: '  Sprint 42 planning  ',
		});
		expect(state.roomName).toBe('Sprint 42 planning');
	});

	test('truncates an overly long room name to 60 characters', () => {
		let state = room();
		const long = 'x'.repeat(80);
		state = joinRoom(state, { id: 'host', name: 'Host', roomName: long });
		expect(state.roomName).toBe('x'.repeat(60));
	});

	test('does not overwrite an already-set room name on later joins', () => {
		let state = room();
		state = joinRoom(state, {
			id: 'host',
			name: 'Host',
			roomName: 'Original Name',
		});
		state = joinRoom(state, {
			id: 'guest',
			name: 'Guest',
			roomName: 'Attempted Override',
		});
		expect(state.roomName).toBe('Original Name');
	});

	test('leaves the room name empty when no join provides one', () => {
		let state = room();
		state = joinRoom(state, { id: 'host', name: 'Host' });
		expect(state.roomName).toBe('');
	});

	test('a whitespace-only room name does not block a later join from setting it', () => {
		let state = room();
		state = joinRoom(state, {
			id: 'host',
			name: 'Host',
			roomName: '   ',
		});
		expect(state.roomName).toBe('');
		state = joinRoom(state, {
			id: 'guest',
			name: 'Guest',
			roomName: 'Real Name',
		});
		expect(state.roomName).toBe('Real Name');
	});
});

describe('host-guarded transitions', () => {
	function seededRoom(): RoomState {
		let state = room();
		state = joinRoom(state, { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });
		return state;
	}

	function votingRoom(): RoomState {
		let state = setTicket(seededRoom(), 'host', 'PAY-1842');
		state = startRound(state, 'host');
		return state;
	}

	function revealedRoom(): RoomState {
		let state = votingRoom();
		state = castVote(state, 'host', ESTIMATE);
		state = castVote(state, 'guest', ESTIMATE);
		state = revealVotes(state, 'host');
		state = completeRevealCountdown(state);
		return state;
	}

	test('the host can set the ticket', () => {
		const state = setTicket(seededRoom(), 'host', 'PAY-1842');
		expect(state.ticketTitle).toBe('PAY-1842');
	});

	test('a non-host cannot set the ticket', () => {
		const before = seededRoom();
		const after = setTicket(before, 'guest', 'PAY-1842');
		expect(after.ticketTitle).toBe('');
		expect(after).toBe(before);
	});

	test('a non-host cannot reveal votes', () => {
		const before = votingRoom();
		const after = revealVotes(before, 'guest');
		expect(after.votingState).toBe('voting');
		expect(after).toBe(before);
	});

	test('the host starts a reveal countdown before votes are revealed', () => {
		const state = revealVotes(votingRoom(), 'host');
		expect(state.votingState).toBe('countdown');
		expect(state.revealCountdownEndsAt).toEqual(expect.any(Number));
	});

	test('completing a reveal countdown changes the voting state', () => {
		let state = revealVotes(votingRoom(), 'host');
		state = completeRevealCountdown(state);
		expect(state.votingState).toBe('revealed');
		expect(state.revealCountdownEndsAt).toBeNull();
	});

	test('players can update votes during the reveal countdown', () => {
		let state = revealVotes(votingRoom(), 'host');
		const updatedVote: VoteChoice = {
			kind: 'estimate',
			base: '8',
			modifier: 'sharp',
		};

		state = castVote(state, 'guest', updatedVote);

		expect(state.votingState).toBe('countdown');
		expect(state.participants.find((p) => p.id === 'guest')?.vote).toEqual(
			updatedVote,
		);
	});

	test('start_round clears every vote and enters voting', () => {
		let state = votingRoom();
		state = castVote(state, 'host', ESTIMATE);
		state = castVote(state, 'guest', ESTIMATE);
		expect(state.participants.every((p) => p.vote !== null)).toBe(true);

		state = startRound(state, 'host');
		expect(state.votingState).toBe('voting');
		expect(state.participants.every((p) => p.vote === null)).toBe(true);
	});

	test('start_round is ignored before a topic is set', () => {
		const before = seededRoom();
		const after = startRound(before, 'host');
		expect(after).toBe(before);
	});

	test('the current topic cannot be edited once voting has started', () => {
		const before = votingRoom();
		const after = setTicket(before, 'host', 'PAY-9999');
		expect(after).toBe(before);
	});

	test('revealed topic cannot be cleared before it is archived', () => {
		let state = revealedRoom();
		state = setTicket(state, 'host', '');
		state = doneTicket(state, 'host');
		expect(state.completedRounds[0]?.ticketTitle).toBe('PAY-1842');
		expect(state.completedRounds[0]?.votes).toHaveLength(2);
	});

	test('done_ticket archives the revealed topic result', () => {
		const state = doneTicket(revealedRoom(), 'host');
		expect(state.votingState).toBe('completed');
		expect(state.ticketTitle).toBe('');
		expect(state.participants.every((p) => p.vote === null)).toBe(true);
		expect(state.completedRounds).toEqual([
			{
				ticketTitle: 'PAY-1842',
				votes: [
					{ participantId: 'host', participantName: 'Host', vote: ESTIMATE },
					{ participantId: 'guest', participantName: 'Guest', vote: ESTIMATE },
				],
			},
		]);
	});

	test('revealed votes cannot be cleared before they are archived', () => {
		let state = revealedRoom();
		state = clearVote(state, 'guest');
		state = doneTicket(state, 'host');
		expect(state.completedRounds[0]?.votes).toEqual([
			{ participantId: 'host', participantName: 'Host', vote: ESTIMATE },
			{ participantId: 'guest', participantName: 'Guest', vote: ESTIMATE },
		]);
	});

	test('a completed topic can be followed by a new voting topic', () => {
		let state = doneTicket(revealedRoom(), 'host');
		state = setTicket(state, 'host', 'PAY-9999');
		expect(state.votingState).toBe('ready');
		expect(state.ticketTitle).toBe('PAY-9999');

		state = startRound(state, 'host');
		expect(state.votingState).toBe('voting');
		expect(state.completedRounds).toHaveLength(1);
	});

	test('completed topic history keeps only the most recent rounds', () => {
		let state = seededRoom();

		for (let index = 0; index < MAX_COMPLETED_ROUNDS + 2; index += 1) {
			state = setTicket(state, 'host', `PAY-${index}`);
			state = startRound(state, 'host');
			state = castVote(state, 'host', ESTIMATE);
			state = revealVotes(state, 'host');
			state = completeRevealCountdown(state);
			state = doneTicket(state, 'host');
		}

		expect(state.completedRounds).toHaveLength(MAX_COMPLETED_ROUNDS);
		expect(state.completedRounds[0]?.ticketTitle).toBe('PAY-2');
		expect(state.completedRounds.at(-1)?.ticketTitle).toBe(
			`PAY-${MAX_COMPLETED_ROUNDS + 1}`,
		);
	});

	test('a non-host cannot start a round', () => {
		const before = seededRoom();
		const after = startRound(before, 'guest');
		expect(after).toBe(before);
	});
});

describe('voting transitions', () => {
	test('casting a vote keeps the current topic in the voting state', () => {
		let state = joinRoom(room(), { id: 'p1', name: 'Alice' });
		state = setTicket(state, 'p1', 'PAY-1842');
		state = startRound(state, 'p1');
		state = castVote(state, 'p1', ESTIMATE);
		expect(state.votingState).toBe('voting');
		expect(state.participants[0].vote).toEqual(ESTIMATE);
	});

	test('casting a vote is ignored before voting starts', () => {
		let state = joinRoom(room(), { id: 'p1', name: 'Alice' });
		state = setTicket(state, 'p1', 'PAY-1842');
		const after = castVote(state, 'p1', ESTIMATE);
		expect(after).toBe(state);
	});

	test('clearing a vote resets only that participant', () => {
		let state = joinRoom(room(), { id: 'p1', name: 'Alice' });
		state = castVote(state, 'p1', ESTIMATE);
		state = clearVote(state, 'p1');
		expect(state.participants[0].vote).toBeNull();
	});

	test('observers cannot cast votes', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, {
			id: 'observer',
			name: 'Observer',
			role: 'observer',
		});
		state = setTicket(state, 'host', 'PAY-1842');
		state = startRound(state, 'host');

		const after = castVote(state, 'observer', ESTIMATE);

		expect(after).toBe(state);
		expect(
			after.participants.find((p) => p.id === 'observer')?.vote,
		).toBeNull();
	});

	test('switching a voted player to observer clears their vote', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });
		state = setTicket(state, 'host', 'PAY-1842');
		state = startRound(state, 'host');
		state = castVote(state, 'guest', ESTIMATE);

		state = setRole(state, 'guest', 'observer');

		expect(state.participants.find((p) => p.id === 'guest')).toMatchObject({
			role: 'observer',
			vote: null,
		});
	});

	test('host can change another participant role but non-hosts only change themselves', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });

		state = setRole(state, 'host', 'observer', 'guest');
		expect(state.participants.find((p) => p.id === 'guest')?.role).toBe(
			'observer',
		);

		state = setRole(state, 'guest', 'player', 'host');
		expect(state.participants.find((p) => p.id === 'host')?.role).toBe(
			'player',
		);
		expect(state.participants.find((p) => p.id === 'guest')?.role).toBe(
			'player',
		);
	});

	test('host can transfer host status to another participant', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });

		state = transferHost(state, 'host', 'guest');

		expect(state.hostId).toBe('guest');
	});

	test('non-hosts cannot transfer host status', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });

		const after = transferHost(state, 'guest', 'guest');

		expect(after).toBe(state);
		expect(after.hostId).toBe('host');
	});
});

describe('setName', () => {
	test('renames a participant, keeping names unique', () => {
		let state = joinRoom(room(), { id: 'p1', name: 'Alice' });
		state = joinRoom(state, { id: 'p2', name: 'Bob' });
		state = setName(state, 'p2', 'Alice');
		expect(state.participants.find((p) => p.id === 'p2')?.name).toBe('Alice 2');
	});
});

describe('leaveRoom', () => {
	test('reassigns the host to the next participant when the host leaves', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });
		state = leaveRoom(state, 'host');
		expect(state.hostId).toBe('guest');
		expect(state.participants).toHaveLength(1);
	});

	test('reassigns the host to the second entrant when the host leaves a larger room', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'second', name: 'Second' });
		state = joinRoom(state, { id: 'third', name: 'Third' });

		state = leaveRoom(state, 'host');

		expect(state.hostId).toBe('second');
		expect(state.participants.map((participant) => participant.id)).toEqual([
			'second',
			'third',
		]);
	});
});

describe('toRoomStateView', () => {
	test('projects host + connection flags for the wire', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });
		const view = toRoomStateView(state);
		expect(view).toEqual({
			roomId: 'ROOM1',
			roomName: '',
			roomState: 'active',
			votingState: 'noTopic',
			revealCountdownEndsAt: null,
			ticketTitle: '',
			participants: [
				{
					id: 'host',
					name: 'Host',
					role: 'player',
					vote: null,
					hasVoted: false,
					connected: true,
					isHost: true,
				},
				{
					id: 'guest',
					name: 'Guest',
					role: 'player',
					vote: null,
					hasVoted: false,
					connected: true,
					isHost: false,
				},
			],
			completedRounds: [],
		});
	});

	test('redacts other participants raw votes before reveal', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });
		state = setTicket(state, 'host', 'PAY-1842');
		state = startRound(state, 'host');
		state = castVote(state, 'host', ESTIMATE);
		state = castVote(state, 'guest', {
			kind: 'estimate',
			base: '8',
			modifier: 'base',
		});

		const hostView = redactRoomStateViewForParticipant(
			toRoomStateView(state),
			'host',
		);

		expect(hostView.participants).toEqual([
			expect.objectContaining({
				id: 'host',
				vote: ESTIMATE,
				hasVoted: true,
			}),
			expect.objectContaining({
				id: 'guest',
				vote: null,
				hasVoted: true,
			}),
		]);
	});

	test('keeps all raw votes after reveal', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });
		state = setTicket(state, 'host', 'PAY-1842');
		state = startRound(state, 'host');
		state = castVote(state, 'host', ESTIMATE);
		state = castVote(state, 'guest', {
			kind: 'estimate',
			base: '8',
			modifier: 'base',
		});
		state = revealVotes(state, 'host');
		state = completeRevealCountdown(state);

		const hostView = redactRoomStateViewForParticipant(
			toRoomStateView(state),
			'host',
		);

		expect(
			hostView.participants.map((participant) => participant.vote),
		).toEqual([ESTIMATE, { kind: 'estimate', base: '8', modifier: 'base' }]);
	});
});
