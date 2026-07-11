import { expect, test } from '@playwright/test';

test('playground can manually drive simulated player votes', async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/playground.html');
	await page.getByRole('button', { name: /Voting in progress/ }).click();
	await page.getByRole('button', { name: 'Add player' }).click();

	const sim = page.getByRole('listitem').filter({ hasText: 'Sim 1' });
	const simVote = page.getByTestId('sim-vote-sim-1');
	await expect(simVote).toHaveText('1♭');

	await sim.getByRole('button', { name: 'Clear' }).click();
	await expect(simVote).toHaveText('Not voted');

	await sim.getByRole('button', { name: '13' }).click();
	await expect(simVote).toHaveText('13');
});

test('playground simulated player votes stay in sync after host reset', async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/playground.html');

	await page.getByLabel('Current ticket').fill('Checkout flow');
	const startButton = page.locator('.control-pad-start');
	await expect(startButton).toBeEnabled();
	await startButton.evaluate((button: HTMLButtonElement) => button.click());
	await page.getByRole('button', { name: 'Add player' }).click();

	const simVote = page.getByTestId('sim-vote-sim-1');
	await expect(simVote).toHaveText('1♭');

	const resetButton = page.locator('.control-pad-reset');
	await expect(resetButton).toBeEnabled();
	await resetButton.evaluate((button: HTMLButtonElement) => button.click());
	await page.getByRole('button', { name: 'OK' }).click();
	await expect(simVote).toHaveText('Not voted');
});
