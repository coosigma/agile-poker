import { describe, expect, test } from 'vitest';
import {
	type RoomMachineEvent,
	type RoomMachineState,
	transitionRoomState,
} from './room-machine.js';

describe('roomMachine', () => {
	test.each<{
		state: RoomMachineState;
		event: RoomMachineEvent;
		expected: RoomMachineState;
	}>([
		{ state: 'empty', event: { type: 'JOIN' }, expected: 'active' },
		{ state: 'empty', event: { type: 'LEAVE' }, expected: 'empty' },
		{ state: 'active', event: { type: 'JOIN' }, expected: 'active' },
		{ state: 'active', event: { type: 'LEAVE' }, expected: 'active' },
		{
			state: 'active',
			event: { type: 'ROOM_EMPTIED' },
			expected: 'empty',
		},
	])('$state + $event.type -> $expected', ({ state, event, expected }) => {
		expect(transitionRoomState(state, event)).toBe(expected);
	});
});
