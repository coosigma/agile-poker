import { describe, expect, test } from 'vitest';
import { getHealth } from './health.js';
import type { CapabilityProvider } from '../ports/capability-provider.js';

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

describe('getHealth', () => {
	test('returns observable runtime metadata', async () => {
		await expect(getHealth(provider)).resolves.toEqual({
			ok: true,
			appName: 'test-app',
			runtime: 'test',
		});
	});
});
