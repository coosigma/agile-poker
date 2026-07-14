import { createMachine, transition } from 'xstate';

export const VOTING_STATES = [
	'noTopic',
	'ready',
	'voting',
	'countdown',
	'revealed',
	'completed',
] as const;

export type VotingMachineState = (typeof VOTING_STATES)[number];

export type VotingMachineEvent =
	| { readonly type: 'SET_TOPIC' }
	| { readonly type: 'CLEAR_TOPIC' }
	| { readonly type: 'START' }
	| { readonly type: 'VOTE' }
	| { readonly type: 'RESET' }
	| { readonly type: 'REVEAL' }
	| { readonly type: 'COUNTDOWN_DONE' }
	| { readonly type: 'DONE' }
	| { readonly type: 'START_NEXT_TOPIC' };

export const votingMachine = createMachine({
	id: 'voting',
	initial: 'noTopic',
	states: {
		noTopic: {
			on: {
				SET_TOPIC: 'ready',
			},
		},
		ready: {
			on: {
				CLEAR_TOPIC: 'noTopic',
				SET_TOPIC: 'ready',
				START: 'voting',
			},
		},
		voting: {
			on: {
				CLEAR_TOPIC: 'noTopic',
				RESET: 'voting',
				REVEAL: 'countdown',
				VOTE: 'voting',
			},
		},
		countdown: {
			on: {
				COUNTDOWN_DONE: 'revealed',
				VOTE: 'countdown',
			},
		},
		revealed: {
			on: {
				CLEAR_TOPIC: 'noTopic',
				DONE: 'completed',
				RESET: 'voting',
			},
		},
		completed: {
			on: {
				CLEAR_TOPIC: 'noTopic',
				SET_TOPIC: 'ready',
				START_NEXT_TOPIC: 'ready',
			},
		},
	},
});

function isVotingMachineState(value: unknown): value is VotingMachineState {
	return (
		typeof value === 'string' && VOTING_STATES.some((state) => state === value)
	);
}

export function transitionVotingState(
	state: VotingMachineState,
	event: VotingMachineEvent,
): VotingMachineState {
	const snapshot = votingMachine.resolveState({ value: state, context: {} });
	const [next] = transition(votingMachine, snapshot, event);
	if (!isVotingMachineState(next.value)) {
		throw new Error(`Unexpected voting machine state: ${String(next.value)}`);
	}
	return next.value;
}
