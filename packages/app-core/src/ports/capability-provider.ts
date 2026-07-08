export interface SqlStore {
	query<T>(statement: string, params?: readonly unknown[]): Promise<T[]>;
	first<T>(statement: string, params?: readonly unknown[]): Promise<T | null>;
	execute(statement: string, params?: readonly unknown[]): Promise<void>;
}

export interface KeyValueStore {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { readonly ttlSeconds?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
}

export type ObjectBody = ArrayBuffer | ReadableStream | string;

export interface StoredObject {
	readonly body: ReadableStream;
	readonly contentType?: string;
}

export interface ObjectStore {
	put(
		key: string,
		body: ObjectBody,
		options?: { readonly contentType?: string },
	): Promise<void>;
	get(key: string): Promise<StoredObject | null>;
	delete(key: string): Promise<void>;
}

export interface ActorEvent {
	readonly type: string;
	readonly [key: string]: unknown;
}

export interface ActorSnapshot {
	readonly value: unknown;
	readonly context: unknown;
}

export interface ActorHandle {
	send(event: ActorEvent): Promise<ActorSnapshot>;
	getSnapshot(): Promise<ActorSnapshot>;
}

export interface ActorRegistry {
	get(id: string): ActorHandle;
}

export interface AppConfig {
	readonly appName: string;
	readonly runtime: 'cloudflare' | 'self-hosted' | 'test';
}

export interface CapabilityProvider {
	readonly config: AppConfig;
	readonly sql: SqlStore;
	readonly kv: KeyValueStore;
	readonly objects: ObjectStore;
	readonly actors?: ActorRegistry;
}
