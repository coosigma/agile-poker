import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlStore } from '@agile-poker/app-core';

export class NodeSqliteStore implements SqlStore {
	private readonly db: DatabaseSync;

	constructor(databasePath: string) {
		this.db = new DatabaseSync(databasePath);
		this.db.exec('PRAGMA journal_mode = WAL;');
	}

	query<T>(statement: string, params: readonly unknown[] = []): Promise<T[]> {
		return Promise.resolve(
			this.db.prepare(statement).all(...(params as SQLInputValue[])) as T[],
		);
	}

	first<T>(
		statement: string,
		params: readonly unknown[] = [],
	): Promise<T | null> {
		const row = this.db
			.prepare(statement)
			.get(...(params as SQLInputValue[])) as T | undefined;
		return Promise.resolve(row ?? null);
	}

	execute(statement: string, params: readonly unknown[] = []): Promise<void> {
		this.db.prepare(statement).run(...(params as SQLInputValue[]));
		return Promise.resolve();
	}
}
