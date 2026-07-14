import { expect, test } from '@playwright/test';

/**
 * Edge smoke — frontend ↔ backend (one edge = one node pair = one file).
 *
 * The edge carries two interactions whose failure modes are INDEPENDENT: the
 * HTTP `/api` proxy route and the WS `/ws` realtime channel share no code path,
 * so a regression can redden one while the other stays green. Per TESTING.md §6
 * each independent facet is its own `test()` (rather than being folded into one
 * shared test), so each goes red/green on its own; a common-cause outage simply
 * reddens them together. Multiple `expect`s within a single facet are fine.
 * See tests/CONTRACT.md → edge smoke / frontend↔backend.
 */
test.describe('edge: frontend ↔ backend', () => {
	// Facet ① — HTTP /api proxy: the stateless route reaches the backend.
	test('HTTP /api proxy reaches the backend', async ({ request }) => {
		const response = await request.get('/api/health');
		await expect(response).toBeOK();
		await expect(response.json()).resolves.toMatchObject({ ok: true });
	});

	// Facet ② — WS /ws channel: opening a room through the real UI drives a live
	// WebSocket to the Worker/DO and renders the room state it broadcasts back.
	test('WS /ws delivers room state when a host creates a room', async ({
		page,
	}) => {
		await page.addInitScript(() => {
			window.localStorage.setItem('agile-poker:language', 'en');
		});

		await test.step('enter the create-room flow', async () => {
			await page.goto('/');
			await page.getByRole('button', { name: /Create room/ }).click();
			await expect(
				page.getByRole('heading', {
					name: 'Enter your display name to join the room',
				}),
			).toBeVisible();
			await expect(page.getByText(/Room [A-Z0-9]{6}/)).toBeVisible();
		});

		await test.step('join and receive room state over the socket', async () => {
			await page.getByLabel('Display name').fill('Ada');
			await page.getByRole('button', { name: 'Enter room' }).click();

			await expect(page.getByText('Room info')).toBeVisible();
			await expect(page.getByText('Ada')).toBeVisible();
			await expect(page.getByText('Host · Observer')).toBeVisible();
		});
	});
});
