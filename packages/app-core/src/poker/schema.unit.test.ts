import { describe, expect, it } from 'vitest';
import { Effect, Either } from 'effect';
import { decodeClientFrame } from './schema.js';

const decode = (raw: string) =>
	Effect.runSync(Effect.either(decodeClientFrame(raw)));

describe('decodeClientFrame', () => {
	it('accepts a valid join_room payload', () => {
		const result = decode(
			JSON.stringify({
				type: 'join_room',
				roomId: 'ABC',
				name: 'Ada',
				claimHost: true,
			}),
		);
		expect(Either.isRight(result)).toBe(true);
		if (Either.isRight(result)) {
			expect(result.right).toEqual({
				type: 'join_room',
				roomId: 'ABC',
				name: 'Ada',
				claimHost: true,
			});
		}
	});

	it('accepts a valid estimate vote', () => {
		const result = decode(
			JSON.stringify({
				type: 'vote',
				vote: { kind: 'estimate', base: '5', modifier: 'sharp' },
			}),
		);
		expect(Either.isRight(result)).toBe(true);
	});

	it('accepts messages without optional fields', () => {
		expect(Either.isRight(decode(JSON.stringify({ type: 'clear_vote' })))).toBe(
			true,
		);
		expect(
			Either.isRight(decode(JSON.stringify({ type: 'start_round' }))),
		).toBe(true);
		expect(
			Either.isRight(decode(JSON.stringify({ type: 'done_ticket' }))),
		).toBe(true);
	});

	it('rejects malformed JSON with a typed error', () => {
		const result = decode('{ not json');
		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left._tag).toBe('InvalidMessage');
			expect(result.left.reason).toBe('Malformed JSON payload');
		}
	});

	it('rejects an unknown message type with a contract error', () => {
		const result = decode(JSON.stringify({ type: 'nope' }));
		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left.reason).toBe(
				'Payload does not match the message contract',
			);
		}
	});

	it('rejects a vote with an invalid base card', () => {
		const result = decode(
			JSON.stringify({
				type: 'vote',
				vote: { kind: 'estimate', base: '7', modifier: 'flat' },
			}),
		);
		expect(Either.isLeft(result)).toBe(true);
	});

	it('rejects join_room without a roomId', () => {
		const result = decode(JSON.stringify({ type: 'join_room', name: 'Ada' }));
		expect(Either.isLeft(result)).toBe(true);
	});
});
