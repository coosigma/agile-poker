import type { KeyValueStore } from '@agile-poker/app-core';
import type { NodeSqliteStore } from './sqlite-store.js';

export class SqliteKvStore implements KeyValueStore {
	constructor(private readonly sql: NodeSqliteStore) {
		void this.sql.execute(
			'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)',
		);
	}

	async get(key: string): Promise<string | null> {
		const row = await this.sql.first<{
			value: string;
			expires_at: number | null;
		}>('SELECT value, expires_at FROM kv_store WHERE key = ?', [key]);
		if (!row) return null;
		if (row.expires_at && row.expires_at <= Date.now()) {
			await this.delete(key);
			return null;
		}
		return row.value;
	}

	async put(
		key: string,
		value: string,
		options?: { readonly ttlSeconds?: number },
	): Promise<void> {
		const expiresAt = options?.ttlSeconds
			? Date.now() + options.ttlSeconds * 1000
			: null;
		await this.sql.execute(
			'INSERT INTO kv_store (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at',
			[key, value, expiresAt],
		);
	}

	async delete(key: string): Promise<void> {
		await this.sql.execute('DELETE FROM kv_store WHERE key = ?', [key]);
	}
}
