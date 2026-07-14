/**
 * Planning Poker domain types.
 *
 * These are platform-neutral and browser-safe: they are shared by the
 * Cloudflare Durable Object runtime and the React frontend through the
 * `@agile-poker/app-core/poker` entry point.
 */

import type { RoomMachineState } from './room-machine.js';
import type { VotingMachineState } from './voting-machine.js';

export const NUMERIC_CARD_VALUES = [
	'0',
	'1',
	'2',
	'3',
	'5',
	'8',
	'13',
	'21',
	'34',
] as const;

export const SPECIAL_CARD_VALUES = ['?', '∞'] as const;

export const MODIFIER_OPTIONS = ['flat', 'base', 'sharp'] as const;

export type NumericCardValue = (typeof NUMERIC_CARD_VALUES)[number];
export type SpecialCardValue = (typeof SPECIAL_CARD_VALUES)[number];
export type VoteModifier = (typeof MODIFIER_OPTIONS)[number];

export type VoteChoice =
	| {
			readonly kind: 'estimate';
			readonly base: NumericCardValue;
			readonly modifier: VoteModifier;
	  }
	| { readonly kind: 'special'; readonly value: SpecialCardValue };

export type ParticipantRole = 'player' | 'observer';

/**
 * A participant as tracked inside the room domain. Transport concerns (the
 * live WebSocket) are intentionally kept out of the domain model so the
 * transition logic stays pure and testable.
 */
export interface Participant {
	readonly id: string;
	readonly name: string;
	readonly role: ParticipantRole;
	readonly vote: VoteChoice | null;
}

export interface CompletedVote {
	readonly participantId: string;
	readonly participantName: string;
	readonly vote: VoteChoice;
}

export interface CompletedRound {
	readonly ticketTitle: string;
	readonly votes: readonly CompletedVote[];
}

/**
 * Authoritative room state owned by the Durable Object. `participants` keeps
 * insertion order, which the host-selection rule depends on.
 */
export interface RoomState {
	readonly roomId: string;
	readonly roomState: RoomMachineState;
	readonly votingState: VotingMachineState;
	readonly revealCountdownEndsAt: number | null;
	readonly hostId: string | null;
	readonly ticketTitle: string;
	readonly participants: readonly Participant[];
	readonly completedRounds: readonly CompletedRound[];
}

/** Participant shape sent to clients (host + connection flags derived). */
export interface ParticipantView {
	readonly id: string;
	readonly name: string;
	readonly role: ParticipantRole;
	readonly vote: VoteChoice | null;
	readonly hasVoted: boolean;
	readonly connected: boolean;
	readonly isHost: boolean;
}

/** Room shape sent to clients over the wire. */
export interface RoomStateView {
	readonly roomId: string;
	readonly roomState: RoomMachineState;
	readonly votingState: VotingMachineState;
	readonly revealCountdownEndsAt: number | null;
	readonly ticketTitle: string;
	readonly participants: readonly ParticipantView[];
	readonly completedRounds: readonly CompletedRound[];
}

export type ClientMessage =
	| {
			readonly type: 'join_room';
			readonly roomId: string;
			readonly name?: string;
			readonly claimHost?: boolean;
			readonly role?: ParticipantRole;
	  }
	| { readonly type: 'set_name'; readonly name?: string }
	| {
			readonly type: 'set_role';
			readonly participantId?: string;
			readonly role: ParticipantRole;
	  }
	| {
			readonly type: 'transfer_host';
			readonly participantId: string;
	  }
	| { readonly type: 'set_ticket'; readonly ticketTitle?: string }
	| { readonly type: 'vote'; readonly vote?: VoteChoice }
	| { readonly type: 'clear_vote' }
	| { readonly type: 'start_round' }
	| { readonly type: 'reveal_votes' }
	| { readonly type: 'done_ticket' };

export type ServerMessage =
	| {
			readonly type: 'room_state';
			readonly state: RoomStateView;
			readonly selfId: string;
	  }
	| { readonly type: 'error'; readonly message: string };
