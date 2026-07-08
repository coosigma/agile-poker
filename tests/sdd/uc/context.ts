import type { Browser, BrowserContext, Page } from '@playwright/test';
import { forceEnglish } from '../utils/app';

/**
 * Mutable state threaded through the use-cases as the story progresses. Each UC
 * reads the parts its precondition needs and writes the parts its postcondition
 * produces (e.g. `createRoom` writes `roomId`, `shareInviteLink` writes
 * `inviteUrl`).
 */
export interface StoryState {
	roomId?: string;
	inviteUrl?: string;
	/** Host and teammate deliberately vote different estimates (→ a meaningful average). */
	readonly hostVote: string;
	readonly teammateVote: string;
	readonly hostName: string;
	readonly teammateName: string;
}

/**
 * The story runs two independent browser contexts — one per person — held here
 * so use-cases can drive host and teammate and cross-check that the server's
 * broadcast is consistent across both.
 */
export interface StoryContext {
	readonly host: Page;
	readonly teammate: Page;
	readonly hostContext: BrowserContext;
	readonly teammateContext: BrowserContext;
	readonly state: StoryState;
}

/**
 * A use-case: one node/transition of the orchestration machine. It declares the
 * `from`/`to` test-level states (matching `machine.ts`) and a `run` that both
 * performs the action and asserts its postcondition, so it can run standalone
 * and compose.
 */
export interface UseCase {
	readonly id: string;
	readonly description: string;
	readonly from: string;
	readonly to: string;
	run(ctx: StoryContext): Promise<void>;
}

export async function createStoryContext(
	browser: Browser,
): Promise<StoryContext> {
	const hostContext = await browser.newContext({
		permissions: ['clipboard-read', 'clipboard-write'],
	});
	const teammateContext = await browser.newContext();
	await forceEnglish(hostContext);
	await forceEnglish(teammateContext);

	const host = await hostContext.newPage();
	const teammate = await teammateContext.newPage();

	return {
		host,
		teammate,
		hostContext,
		teammateContext,
		state: {
			hostVote: '3',
			teammateVote: '5',
			hostName: 'Alice',
			teammateName: 'Bob',
		},
	};
}

export async function disposeStoryContext(ctx: StoryContext): Promise<void> {
	await ctx.hostContext.close();
	await ctx.teammateContext.close();
}
