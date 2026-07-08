import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RoomDO } from '../src/RoomObject.ts';
import {
	fakeDurableObjectState,
	installPlatformDoubles,
	type MockServerSocket,
	wsUpgradeRequest,
} from './helpers/mock-do-socket.ts';

/**
 * Durable Object adapter boundary and edge paths, driven in-process with socket
 * doubles (no wrangler, no network). Per the layering rule these are
 * integration tests: `RoomDO` needs a stateful runtime and platform socket
 * doubles to run, but touches no real cross-process transport — so every
 * boundary branch is asserted here, cheaply, instead of at the e2e layer.
 *
 * The e2e suite keeps only a single invalid-frame smoke to prove the real
 * transport wiring; everything else lives here.
 */

let platform: ReturnType<typeof installPlatformDoubles>;

beforeEach(() => {
	platform = installPlatformDoubles();
});

afterEach(() => {
	platform.restore();
});

/** Open a fresh socket on the room and return the DO-side socket double. */
async function connect(room: RoomDO): Promise<MockServerSocket> {
	await room.fetch(wsUpgradeRequest());
	return platform.nextServerSocket();
}

function newRoom(id: string): RoomDO {
	return new RoomDO(fakeDurableObjectState(id) as DurableObjectState);
}

function roster(
	socket: MockServerSocket,
): { name: string; isHost: boolean; vote: unknown }[] {
	const frame = socket.lastFrame();
	if (!frame || frame.type !== 'room_state') {
		throw new Error(
			`expected a room_state frame, got ${JSON.stringify(frame)}`,
		);
	}
	const state = frame.state as {
		participants: { name: string; isHost: boolean; vote: unknown }[];
	};
	return state.participants;
}

describe('RoomDO boundary paths', () => {
	it('replies with an error only to the sender of an invalid frame', async () => {
		const room = newRoom('room-bad');
		const host = await connect(room);
		const guest = await connect(room);

		host.message(
			JSON.stringify({
				type: 'join_room',
				roomId: 'room-bad',
				name: 'Ada',
				claimHost: true,
			}),
		);
		await guest.message(
			JSON.stringify({ type: 'join_room', roomId: 'room-bad', name: 'Bob' }),
		);
		const guestFramesBefore = guest.sent.length;

		// Malformed JSON is rejected with a targeted error frame.
		host.sent.length = 0;
		await host.message('this is not json');
		expect(host.lastFrame()).toMatchObject({
			type: 'error',
			message: 'Malformed JSON payload',
		});

		// A schema-violating payload is rejected the same way.
		await host.message(JSON.stringify({ type: 'totally_unknown', foo: 1 }));
		expect(host.lastFrame()).toMatchObject({
			type: 'error',
			message: 'Payload does not match the message contract',
		});

		// The peer is never sent an error frame for someone else's bad input.
		const guestAfter = guest.frames().slice(guestFramesBefore);
		expect(guestAfter.some((f) => f.type === 'error')).toBe(false);
	});

	it('removes the participant and reassigns the host when a socket closes', async () => {
		const room = newRoom('room-leave');
		const host = await connect(room);
		const guest = await connect(room);

		await host.message(
			JSON.stringify({
				type: 'join_room',
				roomId: 'room-leave',
				name: 'Ada',
				claimHost: true,
			}),
		);
		await guest.message(
			JSON.stringify({ type: 'join_room', roomId: 'room-leave', name: 'Bob' }),
		);
		expect(roster(guest)).toHaveLength(2);

		// Host drops: the DO's close handler runs `leave` and broadcasts to the
		// survivor, who is promoted to host.
		await host.close();

		const survivors = roster(guest);
		expect(survivors.map((p) => p.name)).toEqual(['Bob']);
		expect(survivors[0]?.isHost).toBe(true);
	});

	it('broadcasts to every connected socket', async () => {
		const room = newRoom('room-fanout');
		const a = await connect(room);
		const b = await connect(room);
		const c = await connect(room);

		await a.message(
			JSON.stringify({
				type: 'join_room',
				roomId: 'room-fanout',
				name: 'Ada',
				claimHost: true,
			}),
		);
		await b.message(
			JSON.stringify({ type: 'join_room', roomId: 'room-fanout', name: 'Bob' }),
		);
		await c.message(
			JSON.stringify({ type: 'join_room', roomId: 'room-fanout', name: 'Cy' }),
		);

		// After the third join, all three sockets have received the same 3-person
		// roster as their latest frame.
		for (const socket of [a, b, c]) {
			expect(
				roster(socket)
					.map((p) => p.name)
					.sort(),
			).toEqual(['Ada', 'Bob', 'Cy']);
		}
	});

	it('ignores a message received before join_room', async () => {
		const room = newRoom('room-prejoin');
		const client = await connect(room);

		// No participant id has been allocated yet, so this vote must be dropped
		// with no broadcast and no state change.
		await client.message(
			JSON.stringify({
				type: 'vote',
				vote: { kind: 'estimate', base: '5', modifier: 'base' },
			}),
		);
		expect(client.sent).toHaveLength(0);

		await client.message(
			JSON.stringify({
				type: 'join_room',
				roomId: 'room-prejoin',
				name: 'Ada',
				claimHost: true,
			}),
		);
		const frame = client.lastFrame();
		expect(frame?.type).toBe('room_state');
		// If the pre-join vote had applied, the phase would be 'voting'.
		const state = frame?.state as {
			phase: string;
			participants: { vote: unknown }[];
		};
		expect(state.phase).toBe('lobby');
		expect(state.participants[0]?.vote).toBeNull();
	});

	it('does not retain stale participants after the room empties', async () => {
		const room = newRoom('room-empty');

		const first = await connect(room);
		await first.message(
			JSON.stringify({
				type: 'join_room',
				roomId: 'room-empty',
				name: 'Ada',
				claimHost: true,
			}),
		);
		expect(roster(first)).toHaveLength(1);
		await first.close();

		// A fresh socket joining the now-empty room sees only itself and is
		// promoted to host, proving the disconnect cleanup removed the previous
		// occupant from the same DO instance.
		const second = await connect(room);
		await second.message(
			JSON.stringify({ type: 'join_room', roomId: 'room-empty', name: 'Bob' }),
		);

		const view = roster(second);
		expect(view.map((p) => p.name)).toEqual(['Bob']);
		expect(view[0]?.isHost).toBe(true);
	});
});
