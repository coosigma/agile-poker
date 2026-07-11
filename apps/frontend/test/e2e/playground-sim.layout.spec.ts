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
