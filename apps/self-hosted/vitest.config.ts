import { defineConfig } from 'vitest/config';

/**
 * Self-hosted runtime unit tests. They run in the default Node environment so
 * the built-in `node:sqlite` module the adapters depend on is available, and
 * live under `test/` so they stay out of the `tsc` build's `src` rootDir.
 */
export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
	},
});
