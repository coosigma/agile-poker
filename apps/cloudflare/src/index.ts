import { handleRequest } from '@agile-poker/app-core';
import { normalizeRoomId } from '@agile-poker/app-core/poker';
import {
	createCloudflareProvider,
	type CloudflareEnv,
} from './runtime/cloudflare-provider.js';
import { RoomDO } from './RoomObject.js';

const CORS_ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization';

function getCorsOrigin(request: Request): string {
	const origin =
		request.headers.get('Origin') ?? request.headers.get('origin') ?? '';
	if (!origin) {
		return '';
	}

	try {
		const url = new URL(origin);
		if (url.protocol === 'https:' && url.hostname.endsWith('.pages.dev')) {
			return url.origin;
		}
	} catch {
		return '';
	}

	return '';
}

function withCorsHeaders(request: Request, response: Response): Response {
	const origin = getCorsOrigin(request);
	if (!origin) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set('Access-Control-Allow-Origin', origin);
	headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
	headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
	headers.append('Vary', 'Origin');

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function corsPreflightResponse(request: Request): Response {
	const origin = getCorsOrigin(request);
	const headers = new Headers();
	if (origin) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
		headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
		headers.set('Vary', 'Origin');
	}

	return new Response(null, { status: 204, headers });
}

function getRoomIdFromRequest(request: Request): string {
	const url = new URL(request.url);
	const explicitRoomId =
		url.searchParams.get('room') ?? url.searchParams.get('roomId') ?? '';
	if (explicitRoomId) {
		return normalizeRoomId(explicitRoomId);
	}

	const referer =
		request.headers.get('referer') ?? request.headers.get('Referer');
	if (!referer) {
		return '';
	}
	try {
		return normalizeRoomId(new URL(referer).searchParams.get('room') || '');
	} catch {
		return '';
	}
}

export default {
	async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.startsWith('/api') && request.method === 'OPTIONS') {
			return corsPreflightResponse(request);
		}

		// WebSocket: forward the ORIGINAL request to the Durable Object.
		// Recreating the Request drops the upgrade handshake, so never do it.
		if (url.pathname === '/ws') {
			const roomId = getRoomIdFromRequest(request);
			if (!roomId) {
				return Response.json({ error: 'Missing room id' }, { status: 400 });
			}
			const id = env.ROOM_DO.idFromName(roomId);
			return env.ROOM_DO.get(id).fetch(request);
		}

		// Room existence / creation API, forwarded to the room's Durable Object.
		if (url.pathname.startsWith('/api/rooms/')) {
			const roomId = normalizeRoomId(url.pathname.split('/').pop() || '');
			if (!roomId) {
				return withCorsHeaders(
					request,
					Response.json({ error: 'Missing room id' }, { status: 400 }),
				);
			}
			const id = env.ROOM_DO.idFromName(roomId);
			const response = await env.ROOM_DO.get(id).fetch(request);
			return withCorsHeaders(request, response);
		}

		// Operational health + GraphQL contract served by app-core.
		if (url.pathname === '/api/health' || url.pathname === '/graphql') {
			const response = await handleRequest(
				request,
				createCloudflareProvider(env),
			);
			return withCorsHeaders(request, response);
		}

		return withCorsHeaders(request, new Response('Not found', { status: 404 }));
	},
};

export { RoomDO };
