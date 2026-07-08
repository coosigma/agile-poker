import { describe, expect, test } from 'vitest';
import {
	castVote,
	clearVote,
	createRoomState,
	joinRoom,
	leaveRoom,
	makeUniqueParticipantName,
	normalizeParticipantName,
	normalizeRoomId,
	revealVotes,
	setName,
	setTicket,
	startRound,
	toRoomStateView,
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
});

describe('host-guarded transitions', () => {
	function seededRoom(): RoomState {
		let state = room();
		state = joinRoom(state, { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });
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
		const before = seededRoom();
		const after = revealVotes(before, 'guest');
		expect(after.phase).toBe('lobby');
		expect(after).toBe(before);
	});

	test('the host reveals votes, changing the phase', () => {
		const state = revealVotes(seededRoom(), 'host');
		expect(state.phase).toBe('revealed');
	});

	test('start_round clears every vote and enters voting', () => {
		let state = seededRoom();
		state = castVote(state, 'host', ESTIMATE);
		state = castVote(state, 'guest', ESTIMATE);
		expect(state.participants.every((p) => p.vote !== null)).toBe(true);

		state = startRound(state, 'host');
		expect(state.phase).toBe('voting');
		expect(state.participants.every((p) => p.vote === null)).toBe(true);
	});

	test('a non-host cannot start a round', () => {
		const before = seededRoom();
		const after = startRound(before, 'guest');
		expect(after).toBe(before);
	});
});

describe('voting transitions', () => {
	test('casting a vote moves the room into the voting phase', () => {
		let state = joinRoom(room(), { id: 'p1', name: 'Alice' });
		state = castVote(state, 'p1', ESTIMATE);
		expect(state.phase).toBe('voting');
		expect(state.participants[0].vote).toEqual(ESTIMATE);
	});

	test('clearing a vote resets only that participant', () => {
		let state = joinRoom(room(), { id: 'p1', name: 'Alice' });
		state = castVote(state, 'p1', ESTIMATE);
		state = clearVote(state, 'p1');
		expect(state.participants[0].vote).toBeNull();
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
});

describe('toRoomStateView', () => {
	test('projects host + connection flags for the wire', () => {
		let state = joinRoom(room(), { id: 'host', name: 'Host' });
		state = joinRoom(state, { id: 'guest', name: 'Guest' });
		const view = toRoomStateView(state);
		expect(view).toEqual({
			roomId: 'ROOM1',
			ticketTitle: '',
			phase: 'lobby',
			countdownValue: null,
			participants: [
				{ id: 'host', name: 'Host', vote: null, connected: true, isHost: true },
				{
					id: 'guest',
					name: 'Guest',
					vote: null,
					connected: true,
					isHost: false,
				},
			],
		});
	});
});
