import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { NodeSqliteStore } from '../src/runtime/sqlite-store.js';
import { SqliteKvStore } from '../src/runtime/sqlite-kv-store.js';

/**
 * P5 — self-hosted persistence adapters over the built-in `node:sqlite` driver.
 *
 * An in-memory database keeps each test isolated and fast while exercising the
 * real SQL the adapters run, including the KV upsert/TTL semantics that the
 * Cloudflare KV binding provides in production.
 */

describe('NodeSqliteStore', () => {
	let store: NodeSqliteStore;

	beforeEach(() => {
		store = new NodeSqliteStore(':memory:');
	});

	test('execute + query round-trips rows and binds params', async () => {
		await store.execute(
			'CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)',
		);
		await store.execute('INSERT INTO items (id, name) VALUES (?, ?)', [
			1,
			'Ada',
		]);
		await store.execute('INSERT INTO items (id, name) VALUES (?, ?)', [
			2,
			'Bob',
		]);

		const all = await store.query<{ id: number; name: string }>(
			'SELECT id, name FROM items ORDER BY id',
		);
		expect(all).toEqual([
			{ id: 1, name: 'Ada' },
			{ id: 2, name: 'Bob' },
		]);

		const filtered = await store.query<{ name: string }>(
			'SELECT name FROM items WHERE id = ?',
			[2],
		);
		expect(filtered).toEqual([{ name: 'Bob' }]);
	});

	test('first returns a single row or null', async () => {
		await store.execute(
			'CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)',
		);
		await store.execute('INSERT INTO items (id, name) VALUES (?, ?)', [
			1,
			'Ada',
		]);

		const found = await store.first<{ name: string }>(
			'SELECT name FROM items WHERE id = ?',
			[1],
		);
		expect(found).toEqual({ name: 'Ada' });

		const missing = await store.first(
			'SELECT name FROM items WHERE id = ?',
			[99],
		);
		expect(missing).toBeNull();
	});
});

describe('SqliteKvStore', () => {
	let kv: SqliteKvStore;
	let sql: NodeSqliteStore;

	beforeEach(() => {
		sql = new NodeSqliteStore(':memory:');
		kv = new SqliteKvStore(sql);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('put then get round-trips a value', async () => {
		await kv.put('room:ABC', 'payload');
		expect(await kv.get('room:ABC')).toBe('payload');
	});

	test('get returns null for an unknown key', async () => {
		expect(await kv.get('missing')).toBeNull();
	});

	test('put upserts an existing key', async () => {
		await kv.put('k', 'first');
		await kv.put('k', 'second');
		expect(await kv.get('k')).toBe('second');

		const rows = await sql.query('SELECT key FROM kv_store WHERE key = ?', [
			'k',
		]);
		expect(rows).toHaveLength(1);
	});

	test('delete removes a key', async () => {
		await kv.put('k', 'v');
		await kv.delete('k');
		expect(await kv.get('k')).toBeNull();
	});

	test('a value past its TTL expires and is evicted on read', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));

		await kv.put('session', 'token', { ttlSeconds: 60 });
		expect(await kv.get('session')).toBe('token');

		// Advance beyond the TTL: the read must miss and evict the stale row.
		vi.setSystemTime(new Date('2020-01-01T00:01:01Z'));
		expect(await kv.get('session')).toBeNull();

		const rows = await sql.query('SELECT key FROM kv_store WHERE key = ?', [
			'session',
		]);
		expect(rows).toHaveLength(0);
	});

	test('a value within its TTL is retained', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));

		await kv.put('session', 'token', { ttlSeconds: 3600 });
		vi.setSystemTime(new Date('2020-01-01T00:30:00Z'));
		expect(await kv.get('session')).toBe('token');
	});
});
