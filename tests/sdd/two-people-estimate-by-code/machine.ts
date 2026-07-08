import { createMachine } from 'xstate';

/**
 * Orchestration machine for the `two-people-estimate-by-code` story.
 *
 * Same shape as the invite-link story, differing only in how the teammate
 * reaches the room: the host shares the room *code* (`shareRoomCode`) and the
 * teammate types it (`joinByCode`). Nodes are test-level checkpoints; each
 * transition is a use-case (`../uc/uc-*.ts`). `startNewRound` goes to a distinct
 * `cleared` terminal state so enumeration terminates.
 */
export const twoPeopleEstimateByCodeMachine = createMachine({
	id: 'two-people-estimate-by-code',
	initial: 'anonymousHome',
	states: {
		anonymousHome: {
			on: { createRoom: 'inRoomAsHost' },
		},
		inRoomAsHost: {
			on: { shareRoomCode: 'codeShared' },
		},
		codeShared: {
			on: { joinByCode: 'bothInRoom' },
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
	{ type: 'shareRoomCode' },
	{ type: 'joinByCode' },
	{ type: 'startRound' },
	{ type: 'castVotes' },
	{ type: 'revealVotes' },
	{ type: 'startNewRound' },
] as const;
