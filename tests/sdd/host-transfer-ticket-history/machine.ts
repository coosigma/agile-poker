import { createMachine } from 'xstate';

/**
 * Orchestration machine for the `host-transfer-ticket-history` story.
 *
 * It reuses the invite-link entry path, then verifies that host controls can
 * move to the teammate and that the new host can complete multiple tickets.
 */
export const hostTransferTicketHistoryMachine = createMachine({
	id: 'host-transfer-ticket-history',
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
			on: { transferHost: 'hostTransferred' },
		},
		hostTransferred: {
			on: { completeTicketHistory: 'historyVerified' },
		},
		historyVerified: {
			type: 'final',
		},
	},
});

export const storyEvents = [
	{ type: 'createRoom' },
	{ type: 'shareInviteLink' },
	{ type: 'joinByLink' },
	{ type: 'transferHost' },
	{ type: 'completeTicketHistory' },
] as const;
