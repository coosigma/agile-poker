import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Frontend unit tests run in jsdom so React hooks can be exercised with a mock
 * WebSocket. This suite must stay browser-safe: it only reaches into
 * `@agile-poker/app-core/poker` (the pure entry), never `.../poker/server`, so
 * the `effect` runtime is never pulled into the frontend dependency graph.
 */
export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		environmentOptions: {
			jsdom: { url: 'http://localhost/' },
		},
		include: ['src/**/*.test.{ts,tsx}'],
	},
});
