import type { CapabilityProvider } from '../ports/capability-provider.js';
import { handleGraphql } from './graphql.js';
import { handleHealth } from './health.js';

export async function handleRequest(
	request: Request,
	provider: CapabilityProvider,
): Promise<Response> {
	const url = new URL(request.url);

	if (url.pathname === '/api/health') {
		return handleHealth(provider);
	}

	if (url.pathname === '/graphql') {
		return handleGraphql(request, provider);
	}

	return Response.json({ error: 'Not found' }, { status: 404 });
}
