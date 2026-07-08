import type {
	CapabilityProvider,
	KeyValueStore,
	ObjectStore,
	SqlStore,
} from '@agile-poker/app-core';

export interface CloudflareEnv {
	readonly APP_NAME?: string;
	readonly ROOM_DO: DurableObjectNamespace;
}

/**
 * Round 1 (Planning Poker) keeps all room state inside the RoomDO Durable
 * Object, so no D1/KV/R2 bindings are required yet. These stubs satisfy the
 * CapabilityProvider contract used by the GraphQL/health routes. Wire real
 * stores here when GraphQL-backed persistence is introduced.
 */
function unconfigured(capability: string): never {
	throw new Error(
		`Capability "${capability}" is not configured for the Cloudflare runtime`,
	);
}

const sqlStub: SqlStore = {
	query: () => unconfigured('sql'),
	first: () => unconfigured('sql'),
	execute: () => unconfigured('sql'),
};

const kvStub: KeyValueStore = {
	get: () => unconfigured('kv'),
	put: () => unconfigured('kv'),
	delete: () => unconfigured('kv'),
};

const objectsStub: ObjectStore = {
	put: () => unconfigured('objects'),
	get: () => unconfigured('objects'),
	delete: () => unconfigured('objects'),
};

export function createCloudflareProvider(
	env: CloudflareEnv,
): CapabilityProvider {
	return {
		config: {
			appName: env.APP_NAME ?? 'agile-poker',
			runtime: 'cloudflare',
		},
		sql: sqlStub,
		kv: kvStub,
		objects: objectsStub,
	};
}
