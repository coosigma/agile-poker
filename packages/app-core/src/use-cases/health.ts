import type { CapabilityProvider } from '../ports/capability-provider.js';

export interface HealthView {
	readonly ok: true;
	readonly appName: string;
	readonly runtime: string;
}

export async function getHealth(
	provider: CapabilityProvider,
): Promise<HealthView> {
	return {
		ok: true,
		appName: provider.config.appName,
		runtime: provider.config.runtime,
	};
}
