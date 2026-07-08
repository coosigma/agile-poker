import { describe, expect, test } from 'vitest';
import { handleGraphql } from './graphql.js';
import type {
	ActorEvent,
	ActorHandle,
	ActorSnapshot,
	CapabilityProvider,
} from '../ports/capability-provider.js';

function createProvider(actor?: ActorHandle): CapabilityProvider {
	return {
		config: { appName: 'test-app', runtime: 'test' },
		sql: {
			query: async () => [],
			first: async () => null,
			execute: async () => {},
		},
		kv: {
			get: async () => null,
			put: async () => {},
			delete: async () => {},
		},
		objects: {
			put: async () => {},
			get: async () => null,
			delete: async () => {},
		},
		actors: actor ? { get: () => actor } : undefined,
	};
}

function createGraphqlRequest(body: unknown, method = 'POST'): Request {
	return new Request('https://app.test/graphql', {
		method,
		headers: { 'content-type': 'application/json' },
		body: method === 'GET' ? undefined : JSON.stringify(body),
	});
}

describe('handleGraphql', () => {
	test('returns health metadata', async () => {
		const response = await handleGraphql(
			createGraphqlRequest({
				query: 'query Health { health { ok appName runtime } }',
			}),
			createProvider(),
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: {
				health: {
					ok: true,
					appName: 'test-app',
					runtime: 'test',
				},
			},
		});
	});

	test('honors the selection set', async () => {
		const response = await handleGraphql(
			createGraphqlRequest({ query: '{ health { ok } }' }),
			createProvider(),
		);

		await expect(response.json()).resolves.toEqual({
			data: { health: { ok: true } },
		});
	});

	test('resolves combined query and mutation-free fields together', async () => {
		const snapshot: ActorSnapshot = { value: 'idle', context: { count: 2 } };
		const response = await handleGraphql(
			createGraphqlRequest({
				query: '{ health { ok } actorSnapshot(id: "demo") { value context } }',
			}),
			createProvider({
				send: async () => snapshot,
				getSnapshot: async () => snapshot,
			}),
		);

		await expect(response.json()).resolves.toEqual({
			data: {
				health: { ok: true },
				actorSnapshot: { value: 'idle', context: { count: 2 } },
			},
		});
	});

	test('reads an actor snapshot', async () => {
		const snapshot: ActorSnapshot = { value: 'active', context: { count: 7 } };
		const response = await handleGraphql(
			createGraphqlRequest({
				query:
					'query Snapshot($id: ID!) { actorSnapshot(id: $id) { context } }',
				variables: { id: 'demo' },
			}),
			createProvider({
				send: async () => snapshot,
				getSnapshot: async () => snapshot,
			}),
		);

		await expect(response.json()).resolves.toEqual({
			data: { actorSnapshot: { context: { count: 7 } } },
		});
	});

	test('sends actor events through the actor capability', async () => {
		const snapshot: ActorSnapshot = { value: {}, context: { count: 1 } };
		const events: ActorEvent[] = [];
		const response = await handleGraphql(
			createGraphqlRequest({
				query:
					'mutation SendActorEvent($id: ID!, $event: JSON!) { sendActorEvent(id: $id, event: $event) { value context } }',
				variables: { id: 'demo', event: { type: 'reset' } },
			}),
			createProvider({
				send: async (event) => {
					events.push(event);
					return snapshot;
				},
				getSnapshot: async () => snapshot,
			}),
		);

		expect(events).toEqual([{ type: 'reset' }]);
		await expect(response.json()).resolves.toEqual({
			data: { sendActorEvent: snapshot },
		});
	});

	test('reports a clear error when the actor capability is disabled', async () => {
		const response = await handleGraphql(
			createGraphqlRequest({
				query: '{ actorSnapshot(id: "demo") { context } }',
			}),
			createProvider(),
		);

		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			data: unknown;
			errors: { message: string }[];
		};
		expect(payload.data).toBeNull();
		expect(payload.errors[0]?.message).toBe('Actor capability is not enabled');
	});

	test('supports introspection', async () => {
		const response = await handleGraphql(
			createGraphqlRequest({ query: '{ __schema { queryType { name } } }' }),
			createProvider(),
		);

		await expect(response.json()).resolves.toEqual({
			data: { __schema: { queryType: { name: 'Query' } } },
		});
	});

	test('rejects unknown fields with a validation error', async () => {
		const response = await handleGraphql(
			createGraphqlRequest({ query: '{ nope }' }),
			createProvider(),
		);

		const payload = (await response.json()) as {
			errors: { message: string }[];
		};
		expect(payload.errors.length).toBeGreaterThan(0);
	});

	test('rejects non-POST requests', async () => {
		const response = await handleGraphql(
			createGraphqlRequest({}, 'GET'),
			createProvider(),
		);

		expect(response.status).toBe(405);
	});

	test('rejects invalid JSON bodies', async () => {
		const request = new Request('https://app.test/graphql', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: 'not-json',
		});

		const response = await handleGraphql(request, createProvider());
		expect(response.status).toBe(400);
	});

	test('rejects requests without a query', async () => {
		const response = await handleGraphql(
			createGraphqlRequest({ variables: {} }),
			createProvider(),
		);

		expect(response.status).toBe(400);
	});
});
