import { Effect } from 'effect';
import { describe, expect, test } from 'vitest';
import { RoomStore, makeRoomStoreLayer } from './room-store.js';
import { makeRoomRuntime } from './runtime.js';
import { applyMessage, roomView } from './use-cases.js';
import { createRoomState } from './room-state.js';
import type { Participant, RoomState } from './types.js';

/**
 * P3 — concurrency and per-room isolation for the store/runtime slice.
 *
 * `RoomStore.update` is backed by `Ref.modify`, so interleaved fibers (the
 * Durable Object dispatches inbound frames asynchronously) must never lose a
 * read-modify-write. A naive get-then-set store would drop updates under the
 * unbounded-concurrency schedules exercised here.
 */

const appendParticipant =
	(participant: Participant) =>
	(state: RoomState): RoomState => ({
		...state,
		participants: [...state.participants, participant],
	});

const setVoteFor =
	(id: string) =>
	(state: RoomState): RoomState => ({
		...state,
		participants: state.participants.map((p) =>
			p.id === id ? { ...p, vote: { kind: 'special', value: '?' } } : p,
		),
	});

describe('RoomStore.update atomicity', () => {
	for (const size of [10, 50, 200]) {
		test(`no lost updates across ${size} concurrent appends`, async () => {
			const program = Effect.gen(function* () {
				const store = yield* RoomStore;
				yield* Effect.forEach(
					Array.from({ length: size }, (_v, i) => i),
					(i) =>
						// Yield first to force interleaving before the atomic modify.
						Effect.yieldNow().pipe(
							Effect.flatMap(() =>
								store.update(
									appendParticipant({ id: `p${i}`, name: `P${i}`, vote: null }),
								),
							),
						),
					{ concurrency: 'unbounded' },
				);
				return yield* store.get;
			});

			const finalState = await Effect.runPromise(
				program.pipe(
					Effect.provide(makeRoomStoreLayer(createRoomState('ATOM'))),
				),
			);

			expect(finalState.participants).toHaveLength(size);
			const ids = new Set(finalState.participants.map((p) => p.id));
			expect(ids.size).toBe(size);
			for (let i = 0; i < size; i += 1) {
				expect(ids.has(`p${i}`)).toBe(true);
			}
		});
	}

	test('interleaved votes on distinct participants all land', async () => {
		const size = 100;
		const seeded: RoomState = {
			...createRoomState('VOTES'),
			participants: Array.from({ length: size }, (_v, i) => ({
				id: `p${i}`,
				name: `P${i}`,
				vote: null,
			})),
		};

		const program = Effect.gen(function* () {
			const store = yield* RoomStore;
			yield* Effect.forEach(
				Array.from({ length: size }, (_v, i) => i),
				(i) =>
					Effect.yieldNow().pipe(
						Effect.flatMap(() => store.update(setVoteFor(`p${i}`))),
					),
				{ concurrency: 'unbounded' },
			);
			return yield* store.get;
		});

		const finalState = await Effect.runPromise(
			program.pipe(Effect.provide(makeRoomStoreLayer(seeded))),
		);

		expect(finalState.participants).toHaveLength(size);
		expect(finalState.participants.every((p) => p.vote !== null)).toBe(true);
	});

	test('concurrent votes through the runtime keep every participant', async () => {
		const runtime = makeRoomRuntime(createRoomState('RT'));
		const size = 40;

		await runtime.runPromise(
			applyMessage('p0', {
				type: 'join_room',
				roomId: 'RT',
				name: 'P0',
				claimHost: true,
			}),
		);
		await Promise.all(
			Array.from({ length: size - 1 }, (_v, i) =>
				runtime.runPromise(
					applyMessage(`p${i + 1}`, {
						type: 'join_room',
						roomId: 'RT',
						name: `P${i + 1}`,
					}),
				),
			),
		);
		await runtime.runPromise(
			applyMessage('p0', { type: 'set_ticket', ticketTitle: 'PAY-1842' }),
		);
		await runtime.runPromise(applyMessage('p0', { type: 'start_round' }));
		await Promise.all(
			Array.from({ length: size }, (_v, i) =>
				runtime.runPromise(
					applyMessage(`p${i}`, {
						type: 'vote',
						vote: { kind: 'estimate', base: '3', modifier: 'flat' },
					}),
				),
			),
		);

		const view = await runtime.runPromise(roomView);
		expect(view.participants).toHaveLength(size);
		expect(view.participants.every((p) => p.vote !== null)).toBe(true);
		await runtime.dispose();
	});
});

describe('per-room runtime isolation', () => {
	test('two runtimes keep independent state', async () => {
		const roomA = makeRoomRuntime(createRoomState('A'));
		const roomB = makeRoomRuntime(createRoomState('B'));

		await roomA.runPromise(
			applyMessage('a1', {
				type: 'join_room',
				roomId: 'A',
				name: 'Ada',
				claimHost: true,
			}),
		);
		const viewB = await roomB.runPromise(roomView);

		// Mutating room A must not leak into room B's independent Ref-backed store.
		expect(viewB.participants).toHaveLength(0);
		expect(viewB.roomId).toBe('B');

		await roomB.runPromise(
			applyMessage('b1', {
				type: 'join_room',
				roomId: 'B',
				name: 'Bob',
				claimHost: true,
			}),
		);
		const viewA = await roomA.runPromise(roomView);
		expect(viewA.participants.map((p) => p.name)).toEqual(['Ada']);

		await roomA.dispose();
		await roomB.dispose();
	});

	test('a fresh store layer does not share the seed reference', async () => {
		const seed = createRoomState('SEED');
		const layer = makeRoomStoreLayer(seed);

		const first = await Effect.runPromise(
			Effect.gen(function* () {
				const store = yield* RoomStore;
				yield* store.update(
					appendParticipant({ id: 'x', name: 'X', vote: null }),
				);
				return yield* store.get;
			}).pipe(Effect.provide(layer)),
		);
		expect(first.participants).toHaveLength(1);

		// Building the layer again from the same seed yields a pristine store.
		const second = await Effect.runPromise(
			Effect.gen(function* () {
				const store = yield* RoomStore;
				return yield* store.get;
			}).pipe(Effect.provide(makeRoomStoreLayer(seed))),
		);
		expect(second.participants).toHaveLength(0);
	});
});
