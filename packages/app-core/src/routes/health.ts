import type { CapabilityProvider } from '../ports/capability-provider.js';
import { getHealth } from '../use-cases/health.js';

export async function handleHealth(
	provider: CapabilityProvider,
): Promise<Response> {
	return Response.json(await getHealth(provider));
}
