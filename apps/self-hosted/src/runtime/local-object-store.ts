import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import type {
	ObjectBody,
	ObjectStore,
	StoredObject,
} from '@agile-poker/app-core';

export class FilesystemObjectStore implements ObjectStore {
	constructor(private readonly rootDir: string) {}

	async put(
		key: string,
		body: ObjectBody,
		_options?: { readonly contentType?: string },
	): Promise<void> {
		const filePath = this.resolveKey(key);
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, Buffer.from(await toArrayBuffer(body)));
	}

	async get(key: string): Promise<StoredObject | null> {
		try {
			const file = await readFile(this.resolveKey(key));
			return {
				body: new Response(file).body ?? new ReadableStream(),
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
			throw error;
		}
	}

	async delete(key: string): Promise<void> {
		await rm(this.resolveKey(key), { force: true });
	}

	private resolveKey(key: string): string {
		const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
		const filePath = join(this.rootDir, normalized);
		if (!filePath.startsWith(this.rootDir + sep) && filePath !== this.rootDir) {
			throw new Error('Invalid object key: ' + key);
		}
		return filePath;
	}
}

async function toArrayBuffer(body: ObjectBody): Promise<ArrayBuffer> {
	if (typeof body === 'string') return new TextEncoder().encode(body).buffer;
	if (body instanceof ArrayBuffer) return body;
	return new Response(body).arrayBuffer();
}
