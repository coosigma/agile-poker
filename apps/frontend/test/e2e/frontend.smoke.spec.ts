import { expect, test } from '@playwright/test';

/**
 * frontend node smoke — the web app boots and renders its shell.
 *
 * A node smoke asserts node-intrinsic realism only: the built frontend loads in
 * a real browser and renders far enough to offer the entry actions (create /
 * join a room), independent of any backend. Anything that reaches the backend
 * (opening a room over WS, the /api proxy) is a frontend↔backend *edge*
 * assertion and lives in tests/edge/frontend-backend.smoke.spec.ts, not here.
 * See tests/CONTRACT.md → node smoke / frontend.
 */
test('the app loads and renders its entry shell', async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/');

	await expect(
		page.getByRole('heading', { name: 'Start from one link.' }),
	).toBeVisible();
	await expect(page.getByRole('button', { name: /Create room/ })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /Join an existing room/ }),
	).toBeVisible();
});

test('the role selector supports keyboard radio navigation', async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/?room=ABC123');

	const player = page.getByRole('radio', { name: /Player/ });
	const observer = page.getByRole('radio', { name: /Observer/ });
	await expect(player).toHaveAttribute('aria-checked', 'true');
	await expect(player).toHaveAttribute('tabindex', '0');
	await expect(observer).toHaveAttribute('tabindex', '-1');

	await player.focus();
	await page.keyboard.press('ArrowRight');
	await expect(observer).toHaveAttribute('aria-checked', 'true');
	await expect(observer).toHaveAttribute('tabindex', '0');
	await expect(observer).toBeFocused();

	await page.keyboard.press('ArrowLeft');
	await expect(player).toHaveAttribute('aria-checked', 'true');
	await expect(player).toHaveAttribute('tabindex', '0');
	await expect(player).toBeFocused();
});
