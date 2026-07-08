import { createServer, type IncomingHttpHeaders } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { handleRequest } from '@agile-poker/app-core';
import { createSelfHostedProvider } from './runtime/self-hosted-provider.js';

const port = Number(process.env.SELF_HOSTED_PORT ?? 8788);
const sqlitePath = resolve(process.env.SQLITE_PATH ?? './data/app.sqlite');
const objectsDir = resolve(process.env.OBJECTS_DIR ?? './data/objects');

mkdirSync(dirname(sqlitePath), { recursive: true });
mkdirSync(objectsDir, { recursive: true });

const provider = createSelfHostedProvider({
	appName: process.env.APP_NAME ?? 'agile-poker',
	sqlitePath,
	objectsDir,
});

function toHeaders(nodeHeaders: IncomingHttpHeaders): Headers {
	const headers = new Headers();
	for (const [key, value] of Object.entries(nodeHeaders)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(key, item);
			}
		} else if (value !== undefined) {
			headers.set(key, value);
		}
	}
	return headers;
}

const server = createServer(async (incoming, outgoing) => {
	const url = new URL(
		incoming.url ?? '/',
		`http://${incoming.headers.host ?? 'localhost'}`,
	);
	const request = new Request(url, {
		method: incoming.method,
		headers: toHeaders(incoming.headers),
		body:
			incoming.method === 'GET' || incoming.method === 'HEAD'
				? undefined
				: Readable.toWeb(incoming),
		duplex: 'half',
	} as RequestInit);

	const response = await handleRequest(request, provider);
	outgoing.writeHead(response.status, Object.fromEntries(response.headers));
	if (!response.body) {
		outgoing.end();
		return;
	}
	const body = Buffer.from(await response.arrayBuffer());
	outgoing.end(body);
});

server.listen(port, () => {
	console.log(`Self-hosted worker listening on http://localhost:${port}`);
});
