import { defineConfig, devices } from '@playwright/test';

// When APP_URL points the suite at an already-running (e.g. deployed)
// environment, skip booting the local dev servers entirely.
const appUrl = process.env.APP_URL;
// Optional slow-motion (ms) for watching headed runs; opt-in via env so normal
// (headless) runs are unaffected. Wired to `pnpm test:story:headed`.
const slowMo = Number(process.env.PW_SLOWMO ?? '0') || 0;
const localWebServers = [
	{
		command: 'pnpm dev:cf',
		url: 'http://localhost:8787/api/health',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	{
		command: 'pnpm dev:frontend',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
];

/**
 * Playwright hosts the two e2e families defined in TESTING.md §3, split into
 * projects so they can be routed differently (see tests/CONTRACT.md):
 *
 *   - `smoke`  — functional node & edge smokes. Structural, fast, stable.
 *                Run in remote CI *and* pre-push. Node smokes live inside each
 *                app package (`apps/<node>/test/e2e/`); edge smokes at
 *                repo-level (`tests/edge/`).
 *   - `story`  — story-driven journeys generated from
 *                `tests/sdd/<scenario>/<scenario>.md` (see docs/sdd.md). Realism
 *                demos, slower/brittle: pre-push only, never remote CI.
 *
 * `pnpm test:e2e` runs everything (pre-push); `pnpm test:smoke` runs only the
 * smoke project (CI).
 */
export default defineConfig({
	testDir: '.',
	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	...(appUrl ? {} : { webServer: localWebServers }),
	use: {
		baseURL: appUrl ?? 'http://localhost:5173',
		trace: 'on-first-retry',
		...(slowMo ? { launchOptions: { slowMo } } : {}),
	},
	projects: [
		{
			name: 'smoke',
			testMatch: [
				'apps/*/test/e2e/**/*.smoke.spec.ts',
				'tests/edge/**/*.smoke.spec.ts',
			],
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'story',
			testMatch: ['tests/sdd/generated/**/*.story.spec.ts'],
			use: { ...devices['Desktop Chrome'] },
		},
		{
			// Layout checks: geometry assertions + screenshots of the round-table
			// seating at various crowd sizes. Deterministic (driven by the frontend
			// playground, no worker). Run on demand via `pnpm test:layout`, or as
			// part of the full `pnpm test:e2e`; not wired into the pre-push flow.
			name: 'layout',
			testMatch: ['apps/frontend/test/e2e/**/*.layout.spec.ts'],
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
