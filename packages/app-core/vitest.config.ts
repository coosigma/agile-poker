import { defineConfig } from 'vitest/config';

/**
 * Scope test discovery to the TypeScript sources under `src`. Without this,
 * `vitest` would also pick up the compiled `*.test.js` emitted into `dist` by
 * `pnpm build`, running every suite twice.
 */
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
	},
});
