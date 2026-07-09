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

/** The `My role` badge on the room screen (`Host` / `Member`). */
export function roleBadge(page: Page): Locator {
	return page
		.locator('.meta-list > div')
		.filter({ hasText: 'My role' })
		.locator('strong');
}

/** The `Voted` counter on the room screen, e.g. `1/2`. */
export function votedCount(page: Page): Locator {
	return page
		.locator('.meta-list > div')
		.filter({ hasText: 'Voted' })
		.locator('strong');
}

/** The revealed overall arithmetic average value. */
export function averageValue(page: Page): Locator {
	return page
		.locator('.table-stats-highlights > div')
		.filter({ hasText: 'Overall arithmetic average' })
		.locator('strong');
}

/** A numeric vote card by its face value, e.g. `numericCard(page, '3')`. */
export function numericCard(page: Page, value: string): Locator {
	return page.locator('.card-grid button').filter({
		has: page.locator('span', { hasText: new RegExp(`^${value}$`) }),
	});
}

export function startNewRoundButton(page: Page): Locator {
	return page.getByRole('button', { name: 'Start new round' });
}

export function revealButton(page: Page): Locator {
	return page.getByRole('button', { name: 'Reveal', exact: true });
}

/** The room's code shown in the room topbar, e.g. "Room ABC123". */
export function roomCodeLabel(page: Page): Locator {
	return page.locator('.topbar .eyebrow');
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

/** Host clicks "Start new round" (opens voting, or resets after a reveal). */
export async function clickStartRound(page: Page): Promise<void> {
	await startNewRoundButton(page).click();
}

/** Cast a numeric estimate with the default (base) modifier. */
export async function castNumericVote(
	page: Page,
	value: string,
): Promise<void> {
	await numericCard(page, value).click();
}

/** Host reveals the votes. */
export async function clickReveal(page: Page): Promise<void> {
	await revealButton(page).click();
}

export { expect };
