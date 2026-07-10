import { describe, expect, test } from 'vitest';
import { createRoomState } from './room-state.js';
import { makeRoomRuntime } from './runtime.js';
import { applyMessage, leave, roomView, setRoomId } from './use-cases.js';

/**
 * Exercises the service + use case + runtime slice end to end: a per-room
 * runtime shares a Ref-backed RoomStore across calls, so a sequence of messages
 * mutates state the way the Durable Object drives it.
 */
describe('room use cases through a per-room runtime', () => {
	test('a join_room message makes the sender the host', async () => {
		const runtime = makeRoomRuntime(createRoomState('ABC'));
		const view = await runtime.runPromise(
			applyMessage('host', {
				type: 'join_room',
				roomId: 'ABC',
				name: 'Ada',
				claimHost: true,
			}),
		);
		expect(view.participants).toHaveLength(1);
		expect(view.participants[0]?.name).toBe('Ada');
		expect(view.participants[0]?.isHost).toBe(true);
		await runtime.dispose();
	});

	test('state persists across messages on the same runtime', async () => {
		const runtime = makeRoomRuntime(createRoomState('ABC'));
		await runtime.runPromise(
			applyMessage('host', {
				type: 'join_room',
				roomId: 'ABC',
				name: 'Ada',
				claimHost: true,
			}),
		);
		await runtime.runPromise(
			applyMessage('guest', { type: 'join_room', roomId: 'ABC', name: 'Bob' }),
		);
		await runtime.runPromise(
			applyMessage('host', { type: 'set_ticket', ticketTitle: 'PAY-1842' }),
		);
		await runtime.runPromise(applyMessage('host', { type: 'start_round' }));
		const voted = await runtime.runPromise(
			applyMessage('guest', {
				type: 'vote',
				vote: { kind: 'estimate', base: '5', modifier: 'base' },
			}),
		);
		expect(voted.votingState).toBe('voting');
		expect(voted.participants).toHaveLength(2);

		const revealed = await runtime.runPromise(
			applyMessage('host', { type: 'reveal_votes' }),
		);
		expect(revealed.votingState).toBe('revealed');
		await runtime.dispose();
	});

	test('a non-host cannot reveal votes', async () => {
		const runtime = makeRoomRuntime(createRoomState('ABC'));
		await runtime.runPromise(
			applyMessage('host', {
				type: 'join_room',
				roomId: 'ABC',
				name: 'Ada',
				claimHost: true,
			}),
		);
		await runtime.runPromise(
			applyMessage('guest', { type: 'join_room', roomId: 'ABC', name: 'Bob' }),
		);
		const view = await runtime.runPromise(
			applyMessage('guest', { type: 'reveal_votes' }),
		);
		expect(view.votingState).toBe('noTopic');
		await runtime.dispose();
	});

	test('leave reassigns the host and roomView reflects it', async () => {
		const runtime = makeRoomRuntime(createRoomState('ABC'));
		await runtime.runPromise(
			applyMessage('host', {
				type: 'join_room',
				roomId: 'ABC',
				name: 'Ada',
				claimHost: true,
			}),
		);
		await runtime.runPromise(
			applyMessage('guest', { type: 'join_room', roomId: 'ABC', name: 'Bob' }),
		);
		await runtime.runPromise(leave('host'));
		const view = await runtime.runPromise(roomView);
		expect(view.participants).toHaveLength(1);
		expect(view.participants[0]?.name).toBe('Bob');
		expect(view.participants[0]?.isHost).toBe(true);
		await runtime.dispose();
	});

	test('setRoomId stores and returns the room id', async () => {
		const runtime = makeRoomRuntime(createRoomState('seed-id'));
		const stored = await runtime.runPromise(setRoomId('ROOM42'));
		expect(stored).toBe('ROOM42');
		const view = await runtime.runPromise(roomView);
		expect(view.roomId).toBe('ROOM42');
		await runtime.dispose();
	});

	test('concurrent joins do not lose updates', async () => {
		const runtime = makeRoomRuntime(createRoomState('ABC'));
		await Promise.all(
			Array.from({ length: 25 }, (_unused, i) =>
				runtime.runPromise(
					applyMessage(`p${i}`, {
						type: 'join_room',
						roomId: 'ABC',
						name: `P${i}`,
					}),
				),
			),
		);
		const view = await runtime.runPromise(roomView);
		expect(view.participants).toHaveLength(25);
		await runtime.dispose();
	});
});
