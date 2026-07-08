/**
 * Playground scenarios for the poker room WebSocket domain.
 *
 * Each scenario seeds a {@link MockRoomServer} into a chosen phase with staged
 * participants, then the previewed "You" client connects live via the mock
 * socket and `RoomScreen` renders the resulting state. Seed scripts obey the
 * real reducer's rules (host-only actions come from the seeded host).
 */
import type { ClientMessage } from '@agile-poker/app-core/poker';
import { MockRoomServer } from '../mocks/room-server';

export const PLAYGROUND_ROOM_ID = 'DEMO01';
export const YOU_NAME = 'You';

const ALICE = 'seed-alice';
const BOB = 'seed-bob';

interface SeedStep {
	readonly participantId: string;
	readonly message: ClientMessage;
}

export interface RoomScenario {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	/** Whether the previewed client should claim host on join. */
	readonly selfIsHost: boolean;
	readonly seed: readonly SeedStep[];
}

const join = (
	participantId: string,
	name: string,
	claimHost = false,
): SeedStep => ({
	participantId,
	message: { type: 'join_room', roomId: PLAYGROUND_ROOM_ID, name, claimHost },
});

const estimate = (
	participantId: string,
	base: '0' | '1' | '2' | '3' | '5' | '8' | '13' | '21' | '34',
): SeedStep => ({
	participantId,
	message: { type: 'vote', vote: { kind: 'estimate', base, modifier: 'flat' } },
});

const hostAction = (
	participantId: string,
	type: 'set_ticket' | 'start_round' | 'reveal_votes',
	ticketTitle?: string,
): SeedStep => ({
	participantId,
	message:
		type === 'set_ticket' ? { type: 'set_ticket', ticketTitle } : { type },
});

export const roomScenarios: readonly RoomScenario[] = [
	{
		id: 'host-lobby',
		label: 'Host lobby (empty room)',
		description:
			'You create the room and are the host, waiting in the lobby before anyone else joins.',
		selfIsHost: true,
		seed: [],
	},
	{
		id: 'guest-lobby',
		label: 'Guest lobby (host present)',
		description:
			'Alice already hosts the room; you join as a guest and wait for the round to start.',
		selfIsHost: false,
		seed: [join(ALICE, 'Alice', true), join(BOB, 'Bob')],
	},
	{
		id: 'voting-in-progress',
		label: 'Voting in progress',
		description:
			'A round is underway on a ticket. Alice has voted, Bob has not, and you join mid-vote.',
		selfIsHost: false,
		seed: [
			join(ALICE, 'Alice', true),
			join(BOB, 'Bob'),
			hostAction(ALICE, 'set_ticket', 'Checkout flow refactor'),
			hostAction(ALICE, 'start_round'),
			estimate(ALICE, '5'),
		],
	},
	{
		id: 'revealed',
		label: 'Votes revealed',
		description:
			'The host revealed an estimate round. You join a room that already shows everyone’s cards.',
		selfIsHost: false,
		seed: [
			join(ALICE, 'Alice', true),
			join(BOB, 'Bob'),
			hostAction(ALICE, 'set_ticket', 'Checkout flow refactor'),
			hostAction(ALICE, 'start_round'),
			estimate(ALICE, '5'),
			estimate(BOB, '8'),
			hostAction(ALICE, 'reveal_votes'),
		],
	},
];

/** Build a fresh server seeded into the given scenario's state. */
export function buildScenarioServer(scenario: RoomScenario): MockRoomServer {
	const server = new MockRoomServer(PLAYGROUND_ROOM_ID);
	for (const step of scenario.seed) {
		server.seed(step.participantId, step.message);
	}
	return server;
}

/**
 * Synthesize a "crowd" scenario with `count` seeded guests plus a host, used to
 * stress the round-table seating layout at scale (e.g. `?seats=30`). Half the
 * crowd casts a vote in a revealed round so cards render their busiest content.
 */
export function crowdScenario(count: number): RoomScenario {
	const size = Math.max(0, Math.floor(count));
	const seed: SeedStep[] = [join(ALICE, 'Alice', true)];
	seed.push(hostAction(ALICE, 'set_ticket', 'Capacity planning'));
	seed.push(hostAction(ALICE, 'start_round'));
	seed.push(estimate(ALICE, '5'));
	const bases = ['1', '2', '3', '5', '8', '13'] as const;
	for (let i = 0; i < size; i += 1) {
		const id = `seed-guest-${i}`;
		seed.push(join(id, `Guest ${i + 1}`));
		if (i % 2 === 0) {
			seed.push(estimate(id, bases[i % bases.length]));
		}
	}
	seed.push(hostAction(ALICE, 'reveal_votes'));
	return {
		id: `crowd-${size}`,
		label: `Crowd (${size} + host)`,
		description: `Stress the seating layout with ${size} guests plus the host in a revealed round.`,
		selfIsHost: false,
		seed,
	};
}
