/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Auto-generated NEGATIVE cases for the two-people-estimate-by-code story (reviewed
 * before commit). Implied by the machine / story — NOT written into the .md.
 * Re-run `pnpm test:story:gen`.
 */
import { test } from '@playwright/test';
import { ucEmptyRoomCode } from '../uc/negative/uc-empty-room-code';
import { createStoryContext, disposeStoryContext } from '../uc/context';

test.describe('two people estimate by code — negatives', () => {
	test('an empty room code is rejected', async ({ browser }) => {
		const ctx = await createStoryContext(browser);
		try {
			await test.step('emptyRoomCode', () => ucEmptyRoomCode.run(ctx));
		} finally {
			await disposeStoryContext(ctx);
		}
	});
});
