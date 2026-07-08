import { Effect, Schema } from 'effect';
import {
	MODIFIER_OPTIONS,
	NUMERIC_CARD_VALUES,
	SPECIAL_CARD_VALUES,
	type ClientMessage,
} from './types.js';
import { InvalidMessage } from './errors.js';

/**
 * Effect Schema for the untrusted WebSocket wire contract. This is the boundary
 * decoder: platform runtimes must decode raw frames here instead of casting
 * `JSON.parse(...) as ClientMessage`.
 *
 * Kept out of `./poker` (the browser-safe entry) so the `effect` runtime is
 * never pulled into the frontend bundle; consume it via
 * `@agile-poker/app-core/poker/server`.
 */

const NumericCardValue = Schema.Literal(...NUMERIC_CARD_VALUES);
const SpecialCardValue = Schema.Literal(...SPECIAL_CARD_VALUES);
const VoteModifier = Schema.Literal(...MODIFIER_OPTIONS);

const VoteChoice = Schema.Union(
	Schema.Struct({
		kind: Schema.Literal('estimate'),
		base: NumericCardValue,
		modifier: VoteModifier,
	}),
	Schema.Struct({
		kind: Schema.Literal('special'),
		value: SpecialCardValue,
	}),
);

export const ClientMessageSchema = Schema.Union(
	Schema.Struct({
		type: Schema.Literal('join_room'),
		roomId: Schema.String,
		name: Schema.optional(Schema.String),
		claimHost: Schema.optional(Schema.Boolean),
	}),
	Schema.Struct({
		type: Schema.Literal('set_name'),
		name: Schema.optional(Schema.String),
	}),
	Schema.Struct({
		type: Schema.Literal('set_ticket'),
		ticketTitle: Schema.optional(Schema.String),
	}),
	Schema.Struct({
		type: Schema.Literal('vote'),
		vote: Schema.optional(VoteChoice),
	}),
	Schema.Struct({ type: Schema.Literal('clear_vote') }),
	Schema.Struct({ type: Schema.Literal('start_round') }),
	Schema.Struct({ type: Schema.Literal('reveal_votes') }),
);

/**
 * Decode already-parsed input against the wire contract. Returns an
 * `Effect` that fails with the raw `ParseError` so callers can compose it.
 */
export const decodeClientMessage = Schema.decodeUnknown(ClientMessageSchema);

/**
 * Boundary decoder for a raw WebSocket text frame: parse JSON, then decode
 * against the wire contract. Both failure modes collapse into a typed
 * `InvalidMessage` in the error channel, so the transport adapter handles
 * failure as a value instead of a thrown exception.
 */
export function decodeClientFrame(
	raw: string,
): Effect.Effect<ClientMessage, InvalidMessage> {
	return Effect.try({
		try: () => JSON.parse(raw) as unknown,
		catch: () => new InvalidMessage({ reason: 'Malformed JSON payload' }),
	}).pipe(
		Effect.flatMap((parsed) =>
			decodeClientMessage(parsed).pipe(
				Effect.mapError(
					() =>
						new InvalidMessage({
							reason: 'Payload does not match the message contract',
						}),
				),
			),
		),
	);
}
