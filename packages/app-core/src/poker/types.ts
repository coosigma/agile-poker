/**
 * Planning Poker domain types.
 *
 * These are platform-neutral and browser-safe: they are shared by the
 * Cloudflare Durable Object runtime and the React frontend through the
 * `@agile-poker/app-core/poker` entry point.
 */

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

export const SPECIAL_CARD_VALUES = ['?', '☕'] as const;

export const MODIFIER_OPTIONS = ['flat', 'base', 'sharp'] as const;

export type NumericCardValue = (typeof NUMERIC_CARD_VALUES)[number];
export type SpecialCardValue = (typeof SPECIAL_CARD_VALUES)[number];
export type VoteModifier = (typeof MODIFIER_OPTIONS)[number];

export type RoomPhase = 'lobby' | 'countdown' | 'voting' | 'revealed';

export type VoteChoice =
	| {
			readonly kind: 'estimate';
			readonly base: NumericCardValue;
			readonly modifier: VoteModifier;
	  }
	| { readonly kind: 'special'; readonly value: SpecialCardValue };

/**
 * A participant as tracked inside the room domain. Transport concerns (the
 * live WebSocket) are intentionally kept out of the domain model so the
 * transition logic stays pure and testable.
 */
export interface Participant {
	readonly id: string;
	readonly name: string;
	readonly vote: VoteChoice | null;
}

/**
 * Authoritative room state owned by the Durable Object. `participants` keeps
 * insertion order, which the host-selection rule depends on.
 */
export interface RoomState {
	readonly roomId: string;
	readonly hostId: string | null;
	readonly ticketTitle: string;
	readonly phase: RoomPhase;
	readonly participants: readonly Participant[];
}

/** Participant shape sent to clients (host + connection flags derived). */
export interface ParticipantView {
	readonly id: string;
	readonly name: string;
	readonly vote: VoteChoice | null;
	readonly connected: boolean;
	readonly isHost: boolean;
}

/** Room shape sent to clients over the wire. */
export interface RoomStateView {
	readonly roomId: string;
	readonly ticketTitle: string;
	readonly phase: RoomPhase;
	readonly countdownValue: number | null;
	readonly participants: readonly ParticipantView[];
}

export type ClientMessage =
	| {
			readonly type: 'join_room';
			readonly roomId: string;
			readonly name?: string;
			readonly claimHost?: boolean;
	  }
	| { readonly type: 'set_name'; readonly name?: string }
	| { readonly type: 'set_ticket'; readonly ticketTitle?: string }
	| { readonly type: 'vote'; readonly vote?: VoteChoice }
	| { readonly type: 'clear_vote' }
	| { readonly type: 'start_round' }
	| { readonly type: 'reveal_votes' };

export type ServerMessage =
	| {
			readonly type: 'room_state';
			readonly state: RoomStateView;
			readonly selfId: string;
	  }
	| { readonly type: 'error'; readonly message: string };
