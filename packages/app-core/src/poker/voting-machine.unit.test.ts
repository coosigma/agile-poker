import { describe, expect, test } from 'vitest';
import {
	type VotingMachineEvent,
	type VotingMachineState,
	transitionVotingState,
} from './voting-machine.js';

describe('votingMachine', () => {
	test.each<{
		state: VotingMachineState;
		event: VotingMachineEvent;
		expected: VotingMachineState;
	}>([
		{ state: 'noTopic', event: { type: 'SET_TOPIC' }, expected: 'ready' },
		{ state: 'noTopic', event: { type: 'START' }, expected: 'noTopic' },
		{ state: 'ready', event: { type: 'SET_TOPIC' }, expected: 'ready' },
		{ state: 'ready', event: { type: 'START' }, expected: 'voting' },
		{ state: 'ready', event: { type: 'CLEAR_TOPIC' }, expected: 'noTopic' },
		{ state: 'voting', event: { type: 'VOTE' }, expected: 'voting' },
		{ state: 'voting', event: { type: 'RESET' }, expected: 'voting' },
		{ state: 'voting', event: { type: 'REVEAL' }, expected: 'countdown' },
		{
			state: 'countdown',
			event: { type: 'COUNTDOWN_DONE' },
			expected: 'revealed',
		},
		{ state: 'countdown', event: { type: 'VOTE' }, expected: 'countdown' },
		{
			state: 'voting',
			event: { type: 'CLEAR_TOPIC' },
			expected: 'noTopic',
		},
		{ state: 'revealed', event: { type: 'RESET' }, expected: 'voting' },
		{
			state: 'revealed',
			event: { type: 'DONE' },
			expected: 'completed',
		},
		{
			state: 'revealed',
			event: { type: 'CLEAR_TOPIC' },
			expected: 'noTopic',
		},
		{
			state: 'completed',
			event: { type: 'START_NEXT_TOPIC' },
			expected: 'ready',
		},
		{
			state: 'completed',
			event: { type: 'SET_TOPIC' },
			expected: 'ready',
		},
		{
			state: 'completed',
			event: { type: 'CLEAR_TOPIC' },
			expected: 'noTopic',
		},
	])('$state + $event.type -> $expected', ({ state, event, expected }) => {
		expect(transitionVotingState(state, event)).toBe(expected);
	});
});
