import { describe, expect, test } from 'vitest';
import type { CapabilityProvider } from '../ports/capability-provider.js';
import { handleRequest } from './handle-request.js';

const provider: CapabilityProvider = {
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
};

describe('handleRequest', () => {
	test('routes health requests', async () => {
		const response = await handleRequest(
			new Request('https://app.test/api/health'),
			provider,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			appName: 'test-app',
			runtime: 'test',
		});
	});

	test('routes GraphQL requests', async () => {
		const response = await handleRequest(
			new Request('https://app.test/graphql', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ health { ok appName runtime } }' }),
			}),
			provider,
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			data: {
				health: { ok: true, appName: 'test-app', runtime: 'test' },
			},
		});
	});

	test('returns 404 for unknown routes', async () => {
		const response = await handleRequest(
			new Request('https://app.test/nope'),
			provider,
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({ error: 'Not found' });
	});
});
