import type { CapabilityProvider } from '@agile-poker/app-core';
import { NodeSqliteStore } from './sqlite-store.js';
import { FilesystemObjectStore } from './local-object-store.js';
import { SqliteKvStore } from './sqlite-kv-store.js';

export interface SelfHostedRuntimeOptions {
	readonly appName: string;
	readonly sqlitePath: string;
	readonly objectsDir: string;
}

export function createSelfHostedProvider(
	options: SelfHostedRuntimeOptions,
): CapabilityProvider {
	const sql = new NodeSqliteStore(options.sqlitePath);
	return {
		config: {
			appName: options.appName,
			runtime: 'self-hosted',
		},
		sql,
		kv: new SqliteKvStore(sql),
		objects: new FilesystemObjectStore(options.objectsDir),
	};
}
