import { defineConfig } from 'vitest/config';

// Integration tier (test-level >= integration). Cross-subsystem tests that
// wire two or more subsystems together live under `tests/int/`. Single-subsystem
// tests (unit and co-located `*.int.test.ts`) keep their own package-level
// runners via `pnpm -r test`; this config is scoped to the cross-subsystem
// integration suite only.
export default defineConfig({
	test: {
		include: ['tests/int/**/*.test.ts'],
	},
});
