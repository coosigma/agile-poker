import { expect, test, type Page } from '@playwright/test';

// The "Room info" panel (which holds the self-role menu) may start
// collapsed in short-viewport accordion mode; open it if needed before
// interacting with content inside it.
async function ensureRoomInfoOpen(page: Page) {
	const roomInfoPanel = page.locator('.room-info-panel');
	if (
		await roomInfoPanel.evaluate((el) => el.classList.contains('panel-closed'))
	) {
		await roomInfoPanel.locator('.panel-header-toggle').click();
	}
}

// Opening another panel (e.g. Room info, to switch role) can auto-close
// "Voting controls" to keep the newly opened panel free of a scrollbar; open
// it back up before interacting with host controls like Reveal/Done.
async function ensureControlOpen(page: Page) {
	const controlPanel = page
		.locator('.panel')
		.filter({ hasText: 'Voting controls' });
	if (
		(await controlPanel.count()) > 0 &&
		(await controlPanel.evaluate((el) => el.classList.contains('panel-closed')))
	) {
		await controlPanel.locator('.panel-header-toggle').click();
	}
}

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

test('playground can add simulated observers off the table', async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/playground.html');

	await expect(page.locator('.host-board')).toContainText('Host');
	await expect(page.locator('.host-card')).toHaveText('You');
	await expect(page.locator('.observer-bench .observer-card')).toHaveCount(0);
	await page.getByRole('button', { name: 'Add observer' }).click();

	await expect(page.getByTestId('sim-vote-sim-1')).toHaveText('Observer');
	await expect(
		page.locator('.observer-bench .observer-card').filter({
			hasText: 'Observer 1',
		}),
	).toBeVisible();
	await expect(
		page.locator('.table-frame > .seat-card').filter({ hasText: 'Observer 1' }),
	).toHaveCount(0);
});

test('observer sees vote cards but cannot submit votes', async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/playground.html');

	await page.getByLabel('Current ticket').fill('Observer view');
	const startButton = page.locator('.control-pad-start');
	await expect(startButton).toBeEnabled();
	await startButton.evaluate((button: HTMLButtonElement) => button.click());

	const voteCard = page.locator('.card-grid button').filter({
		has: page.locator('span', { hasText: /^5$/ }),
	});
	await expect(voteCard).toBeVisible();
	await expect(voteCard).toBeEnabled();
	await voteCard.click();
	await expect(voteCard).toHaveClass(/active/);
	await expect(page.locator('.room-info-panel .badge')).toHaveText('0/0');
	await expect(
		page.locator('.panel').filter({ hasText: 'Vote cards' }).locator('.badge'),
	).toHaveText('Disabled');
	await expect(page.getByText('Observers do not vote')).toHaveCount(0);
});

test('vote cards auto-submit selected point and modifier together', async ({
	page,
}) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/playground.html');

	await page.getByLabel('Current ticket').fill('Draft vote');
	const startButton = page.locator('.control-pad-start');
	await expect(startButton).toBeEnabled();
	await startButton.evaluate((button: HTMLButtonElement) => button.click());
	await ensureRoomInfoOpen(page);
	await page.locator('.self-role-menu summary').click();
	await page
		.locator('.self-role-menu')
		.getByRole('button', { name: 'Player' })
		.click();

	const votePanel = page.locator('.panel').filter({ hasText: 'Vote cards' });
	await expect(votePanel.locator('.badge')).toHaveText('Not voted');

	await page.getByRole('button', { name: 'More' }).click();
	await expect(votePanel.locator('.badge')).toHaveText('Not voted');
	await page
		.locator('.card-grid button')
		.filter({
			has: page.locator('span', { hasText: /^5$/ }),
		})
		.click();
	await expect(votePanel.locator('.badge')).toHaveText('5♯');

	await ensureControlOpen(page);
	const revealButton = page.locator('.control-pad-reveal');
	await expect(revealButton).toBeEnabled();
	await revealButton.evaluate((button: HTMLButtonElement) => button.click());
	await page.getByRole('button', { name: 'OK' }).click();
	await page
		.locator('.card-grid button')
		.filter({
			has: page.locator('span', { hasText: /^8$/ }),
		})
		.click();
	await expect(votePanel.locator('.badge')).toHaveText('8♯');
	await expect(page.getByTestId('reveal-countdown')).toBeHidden({
		timeout: 4000,
	});
	await expect(page.locator('.host-player-card')).toContainText('8♯');
});

test('self role changes through the edit menu', async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/playground.html');

	const roleRow = page.locator('.meta-list > div').filter({ hasText: 'Role' });
	await expect(roleRow).toContainText('Host · Observer');
	await expect(page.locator('.host-board')).toContainText('Host');
	await expect(page.locator('.host-card')).toHaveText('You');
	await expect(
		page.locator('.observer-bench .observer-card').filter({ hasText: 'You' }),
	).toHaveCount(0);
	await ensureRoomInfoOpen(page);
	await page.locator('.self-role-menu summary').click();
	await page
		.locator('.self-role-menu')
		.getByRole('button', { name: 'Player' })
		.click();

	await expect(page.locator('.self-role-menu')).not.toHaveAttribute('open', '');
	await expect(roleRow).toContainText('Host · Player');
	await expect(page.locator('.host-board')).toHaveCount(0);
	await expect(page.locator('.host-player-card')).toContainText('You · Host');
	await expect(page.locator('.host-player-card')).toContainText('Not voted');
	await expect(
		page.locator('.table-frame > .seat-card:not(.host-player-card)').filter({
			hasText: 'You',
		}),
	).toHaveCount(0);
});

test('host changes participant role through card menu', async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/playground.html');

	await page.getByRole('button', { name: 'Add player' }).click();
	await page.getByRole('button', { name: 'Add player' }).click();
	const playerCard = page.locator('.table-frame > .seat-card').filter({
		hasText: 'Sim 1',
	});
	const secondPlayerCard = page.locator('.table-frame > .seat-card').filter({
		hasText: 'Sim 2',
	});
	await expect(playerCard).toBeVisible();
	await expect(secondPlayerCard).toBeVisible();
	await playerCard.locator('.seat-role-menu summary').click();
	await expect(page.locator('.seat-role-menu[open]')).toHaveCount(1);
	await secondPlayerCard.locator('.seat-role-menu summary').click();
	await expect(page.locator('.seat-role-menu[open]')).toHaveCount(1);
	await expect(secondPlayerCard.locator('.seat-role-menu')).toHaveAttribute(
		'open',
		'',
	);
	await page.locator('.table-center').click();
	await expect(page.locator('.seat-role-menu[open]')).toHaveCount(0);

	await playerCard.locator('.seat-role-menu summary').click();
	await playerCard.getByRole('button', { name: 'Make observer' }).click();
	await expect(page.locator('.seat-role-menu[open]')).toHaveCount(0);

	const observerCard = page.locator('.observer-bench .observer-card').filter({
		hasText: 'Sim 1',
	});
	await expect(observerCard).toBeVisible();
	await observerCard.locator('.seat-role-menu summary').click();
	await observerCard.getByRole('button', { name: 'Make player' }).click();
	await expect(page.locator('.seat-role-menu[open]')).toHaveCount(0);

	await expect(
		page.locator('.table-frame > .seat-card').filter({ hasText: 'Sim 1' }),
	).toBeVisible();
});

test('host transfers host status through card menu', async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('agile-poker:language', 'en');
	});
	await page.goto('/playground.html');

	await page.getByRole('button', { name: 'Add player' }).click();
	const playerCard = page.locator('.table-frame > .seat-card').filter({
		hasText: 'Sim 1',
	});
	await expect(playerCard).toBeVisible();

	await playerCard.locator('.seat-role-menu summary').click();
	await playerCard.getByRole('button', { name: 'Make host' }).click();

	await expect(page.locator('.host-player-card')).toContainText('Sim 1 · Host');
	await expect(
		page.locator('.meta-list > div').filter({ hasText: 'Role' }),
	).toContainText('Observer');
	await expect(
		page.locator('.meta-list > div').filter({ hasText: 'Role' }),
	).not.toContainText('Host');
	await expect(page.locator('.seat-role-menu')).toHaveCount(0);
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

test('playground shows a countdown before revealing votes', async ({
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

	const revealButton = page.locator('.control-pad-reveal');
	await expect(revealButton).toBeEnabled();
	await revealButton.evaluate((button: HTMLButtonElement) => button.click());
	await page.getByRole('button', { name: 'OK' }).click();

	const countdown = page.getByTestId('reveal-countdown');
	await expect(countdown).toBeVisible();
	await expect(
		page.locator('main.table-zone > .countdown-overlay'),
	).toBeVisible();
	await expect(countdown).toContainText(/[123]/);
	await expect(countdown).not.toContainText('Revealing');
	const ticketInput = page.getByLabel('Current ticket');
	await expect(ticketInput).toHaveAttribute('readonly', '');
	await ticketInput.click();
	await expect(
		page.getByText('Click Done to finish voting before editing.'),
	).toBeVisible();
	await expect(countdown).toBeHidden({ timeout: 4000 });
	await expect(
		page.getByRole('listitem').filter({ hasText: 'Sim 1' }),
	).toContainText('1♭');

	await expect(ticketInput).toHaveAttribute('readonly', '');
	await ticketInput.click();
	await expect(
		page.getByText('Click Done to finish voting before editing.'),
	).toBeVisible();

	await page
		.locator('.control-pad-done')
		.evaluate((button: HTMLButtonElement) => button.click());
	await expect(ticketInput).toHaveValue('');
	const historySlide = page.locator('.ticket-history-slide');
	await expect(historySlide.locator('.ticket-history-self-vote')).toHaveCount(
		0,
	);
	await ensureRoomInfoOpen(page);
	await page.locator('.self-role-menu summary').click();
	await page
		.locator('.self-role-menu')
		.getByRole('button', { name: 'Player' })
		.click();
	await expect(historySlide.locator('.ticket-history-self-vote')).toContainText(
		'You:',
	);
	await expect(historySlide.locator('.ticket-history-self-vote')).toContainText(
		'Not voted',
	);
	await expect(historySlide.locator('.ticket-history-stats')).toContainText(
		'1',
	);
	await expect(historySlide.locator('.ticket-history-stats')).toContainText(
		'0.5',
	);
	await expect(historySlide.locator('.ticket-history-stats')).toContainText(
		'0.0',
	);
});
