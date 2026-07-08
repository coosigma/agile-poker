import { createMachine } from 'xstate';

/**
 * Orchestration machine for the `two-people-estimate` story.
 *
 * The nodes are NOT app components — each state is a test-level checkpoint and
 * each transition is a use-case (`../uc/uc-*.ts`). The generator enumerates this
 * machine (state coverage via `getShortestPaths`) to emit the committed spec.
 *
 * The story is linear, so `getShortestPaths` yields a single terminal path that
 * covers every state. `startNewRound` goes to a distinct `cleared` terminal
 * state (rather than looping back to `roundOpen`) so enumeration terminates.
 */
export const twoPeopleEstimateMachine = createMachine({
	id: 'two-people-estimate',
	initial: 'anonymousHome',
	states: {
		anonymousHome: {
			on: { createRoom: 'inRoomAsHost' },
		},
		inRoomAsHost: {
			on: { shareInviteLink: 'linkShared' },
		},
		linkShared: {
			on: { joinByLink: 'bothInRoom' },
		},
		bothInRoom: {
			on: { startRound: 'roundOpen' },
		},
		roundOpen: {
			on: { castVotes: 'votesCast' },
		},
		votesCast: {
			on: { revealVotes: 'revealed' },
		},
		revealed: {
			on: { startNewRound: 'cleared' },
		},
		cleared: {
			type: 'final',
		},
	},
});

/** The event alphabet used to enumerate the machine (one event per use-case). */
export const storyEvents = [
	{ type: 'createRoom' },
	{ type: 'shareInviteLink' },
	{ type: 'joinByLink' },
	{ type: 'startRound' },
	{ type: 'castVotes' },
	{ type: 'revealVotes' },
	{ type: 'startNewRound' },
] as const;
