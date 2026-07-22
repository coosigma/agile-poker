import {
	expect,
	type BrowserContext,
	type Locator,
	type Page,
} from '@playwright/test';

/**
 * Shared UI code utilities for the `two-people-estimate` story. These are plain
 * code helpers (page-object style) that wrap the real frontend's screens and
 * controls — not a Gherkin-style step layer. Use-cases (`../uc/uc-*.ts`) compose
 * these; de-duplication across UCs happens here.
 *
 * Selectors are semantic (role / visible text) per docs/sdd.md. The app renders
 * i18n text with no `data-testid`; we pin the language to English up-front so
 * the visible-text selectors are stable.
 */

const LANGUAGE_KEY = 'agile-poker:language';

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Force the app into English so text selectors are deterministic. */
export async function forceEnglish(context: BrowserContext): Promise<void> {
	await context.addInitScript(
		([key]) => {
			try {
				window.localStorage.setItem(key as string, 'en');
			} catch {
				/* storage may be unavailable; ignore */
			}
		},
		[LANGUAGE_KEY],
	);
}

// --- room-screen locators ------------------------------------------------

/** The `Role` badge on the room screen (`Host · Observer` / `Player`). */
export function roleBadge(page: Page): Locator {
	return page
		.locator('.meta-list > div')
		.filter({ hasText: 'Role' })
		.locator('strong');
}

export async function switchSelfRole(
	page: Page,
	role: 'Player' | 'Observer',
): Promise<void> {
	await page.locator('.self-role-menu summary').click();
	await page
		.locator('.self-role-menu')
		.getByRole('button', { name: role, exact: true })
		.click();
}

/** The vote-progress counter badge on the Room info panel, e.g. `1/2`. */
export function votedCount(page: Page): Locator {
	return page.locator('.room-info-panel .badge');
}

/** A value on the revealed scoreboard, selected by its label. */
export function scoreboardValue(page: Page, label: string): Locator {
	return page
		.locator('.scoreboard-cell')
		.filter({ hasText: label })
		.locator('.scoreboard-value');
}

export function votesValue(page: Page): Locator {
	return scoreboardValue(page, 'Votes');
}

/** The revealed mean (average) value on the scoreboard. */
export function averageValue(page: Page): Locator {
	return scoreboardValue(page, 'Mean');
}

export function stdDevValue(page: Page): Locator {
	return scoreboardValue(page, 'Std dev');
}

export function participantSeat(page: Page, name: string): Locator {
	return page.locator('.seat-card').filter({
		has: page.locator('.seat-name', {
			hasText: new RegExp(`^${escapeRegExp(name)}(?:\\s+·\\s+Host)?$`),
		}),
	});
}

export function participantVoteValue(page: Page, name: string): Locator {
	return participantSeat(page, name).locator('strong');
}

/** A numeric vote card by its face value, e.g. `numericCard(page, '3')`. */
export function numericCard(page: Page, value: string): Locator {
	return page.locator('.card-grid button').filter({
		has: page.locator('span', { hasText: new RegExp(`^${value}$`) }),
	});
}

export function specialCard(page: Page, value: '?' | '∞'): Locator {
	return page.locator('.special-card-row button').filter({
		hasText: new RegExp(`^${escapeRegExp(value)}$`),
	});
}

export function startRoundButton(page: Page): Locator {
	return page.getByRole('button', { name: 'Start', exact: true });
}

export function resetRoundButton(page: Page): Locator {
	return page.getByRole('button', { name: 'Reset', exact: true });
}

export function revealButton(page: Page): Locator {
	return page.getByRole('button', { name: 'Reveal', exact: true });
}

export function confirmControlButton(page: Page): Locator {
	return page.getByRole('button', { name: 'OK', exact: true });
}

export function doneButton(page: Page): Locator {
	return page.getByRole('button', { name: 'Done', exact: true });
}

export function ticketHistoryPanel(page: Page): Locator {
	return page.locator('.panel').filter({ hasText: 'Tickets history' });
}

export function ticketHistoryTitle(page: Page): Locator {
	return ticketHistoryPanel(page)
		.locator('.ticket-history-slide .completed-round-title > strong')
		.first();
}

export function ticketHistoryStat(page: Page, label: string): Locator {
	return ticketHistoryPanel(page)
		.locator('.ticket-history-stats > div')
		.filter({ hasText: label })
		.locator('strong');
}

export function ticketHistorySelfVote(page: Page): Locator {
	return ticketHistoryPanel(page).locator('.ticket-history-self-vote');
}

export function olderTicketButton(page: Page): Locator {
	return ticketHistoryPanel(page).getByRole('button', {
		name: 'Previous ticket',
	});
}

export function newerTicketButton(page: Page): Locator {
	return ticketHistoryPanel(page).getByRole('button', {
		name: 'Next ticket',
	});
}

/** The room's code shown in the room topbar heading, e.g. "ABC123". */
export function roomCodeLabel(page: Page): Locator {
	return page.locator('.topbar .room-title');
}

// --- flows ---------------------------------------------------------------

/** Fill the display-name form and enter the room. */
async function enterName(page: Page, name: string): Promise<void> {
	await page.getByPlaceholder('Alice').fill(name);
	await page.getByRole('button', { name: 'Enter room' }).click();
}

/**
 * Create a fresh room as host: home → "Create room" → name entry → room.
 * Returns the freshly allocated room id (read from the resulting `?room=` URL).
 */
export async function createRoomAsHost(
	page: Page,
	name: string,
): Promise<string> {
	await page.goto('/');
	await page.getByRole('button', { name: /Create room/i }).click();
	await enterName(page, name);
	await page.waitForURL(/\?room=/);
	const roomId = new URL(page.url()).searchParams.get('room');
	if (!roomId) {
		throw new Error('room id missing from URL after creating a room');
	}
	return roomId;
}

/** Host copies the invite link; returns the copied URL (clipboard, with fallback). */
export async function copyInviteLink(
	page: Page,
	roomId: string,
): Promise<string> {
	await page.getByRole('button', { name: 'Copy invite link' }).click();
	let url = '';
	try {
		url = await page.evaluate(() => navigator.clipboard.readText());
	} catch {
		/* clipboard read may be blocked; fall back below */
	}
	if (!url.includes('room=')) {
		const current = new URL(page.url());
		url = `${current.origin}${current.pathname}?room=${roomId}`;
	}
	return url;
}

/** A teammate opens an invite link and joins as a member. */
export async function joinByInviteLink(
	page: Page,
	inviteUrl: string,
	name: string,
): Promise<void> {
	await page.goto(inviteUrl);
	await enterName(page, name);
	await page.waitForURL(/\?room=/);
}

/** Host reads the room code from the room topbar (strips the "Room " label). */
export async function readRoomCode(page: Page): Promise<string> {
	const label = (await roomCodeLabel(page).innerText()).trim();
	// Label is "<Room> <CODE>"; the code is the last whitespace-separated token.
	const code = label.split(/\s+/).pop() ?? '';
	if (!code) {
		throw new Error(`could not read room code from label "${label}"`);
	}
	return code;
}

/**
 * A teammate joins via the "Join an existing room" door by typing the room
 * code: home → Join an existing room → enter code → Continue → name → room.
 */
export async function joinByRoomCode(
	page: Page,
	code: string,
	name: string,
): Promise<void> {
	await page.goto('/');
	await page.getByRole('button', { name: 'Join an existing room' }).click();
	await page.getByPlaceholder('AB12CD').fill(code);
	await page.getByRole('button', { name: 'Continue' }).click();
	await enterName(page, name);
	await page.waitForURL(/\?room=/);
}

/** Attempt to reach the name step with a room code; returns the visible error text, or `''` if it advanced instead. */
export async function attemptJoinByRoomCode(
	page: Page,
	code: string,
): Promise<string> {
	await page.goto('/');
	await page.getByRole('button', { name: 'Join an existing room' }).click();
	await page.getByPlaceholder('AB12CD').fill(code);
	await page.getByRole('button', { name: 'Continue' }).click();
	const error = page.locator('.error-text');
	// Settle on either the client-side rejection or the next (name) step.
	await error.or(page.getByPlaceholder('Alice')).first().waitFor();
	return (await error.count()) > 0 ? (await error.innerText()).trim() : '';
}

/** Host types a ticket id and saves it (required before the first round can start). */
export async function setTicket(page: Page, ticket: string): Promise<void> {
	await page.getByLabel('Current ticket', { exact: true }).fill(ticket);
	await page
		.getByRole('button', { name: 'Update ticket', exact: true })
		.click();
}

/**
 * The control pad renders Start/Reset/Reveal/Done as wedge-shaped buttons that
 * each fill the 184px circle and are clipped into a quadrant. Their geometric
 * centre lands in the pad's hollow hub (covered by the OK button), so a default
 * centre-click misses the wedge. Click the visible arc of each wedge instead.
 */
const CONTROL_PAD_WEDGE = {
	start: { x: 92, y: 45 },
	reset: { x: 45, y: 92 },
	reveal: { x: 140, y: 92 },
	done: { x: 92, y: 140 },
} as const;

/** Host clicks "Start" for a lobby round, or "Reset" for a voted round. */
export async function clickStartRound(page: Page): Promise<void> {
	const resetButton = page.getByRole('button', { name: 'Reset', exact: true });
	if (await resetButton.isEnabled()) {
		await resetButton.click({ position: CONTROL_PAD_WEDGE.reset });
		await confirmControlButton(page).click();
		return;
	}
	await page
		.getByRole('button', { name: 'Start', exact: true })
		.click({ position: CONTROL_PAD_WEDGE.start });
}

/** Cast a numeric estimate with the default (base) modifier. */
export async function castNumericVote(
	page: Page,
	value: string,
): Promise<void> {
	await numericCard(page, value).click();
}

export async function castNumericVoteWithModifier(
	page: Page,
	value: string,
	modifier: 'Less' | 'Base' | 'More',
): Promise<void> {
	await page.getByRole('button', { name: modifier, exact: true }).click();
	await castNumericVote(page, value);
}

export async function castSpecialVote(
	page: Page,
	value: '?' | '∞',
): Promise<void> {
	await specialCard(page, value).click();
}

/** Host reveals the votes. */
export async function clickReveal(page: Page): Promise<void> {
	await revealButton(page).click({ position: CONTROL_PAD_WEDGE.reveal });
	await confirmControlButton(page).click();
}

export async function clickDone(page: Page): Promise<void> {
	await expect(doneButton(page)).toBeEnabled();
	await doneButton(page).click({ position: CONTROL_PAD_WEDGE.done });
}

export async function transferHostTo(page: Page, participantName: string) {
	const participant = participantSeat(page, participantName);
	await participant.locator('.seat-role-menu summary').click();
	await participant.getByRole('button', { name: 'Make host' }).click();
}

export { expect };
