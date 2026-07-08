/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Auto-generated NEGATIVE cases for the two-people-estimate story (reviewed
 * before commit). Implied by the machine / story — NOT written into the .md.
 * Re-run `pnpm test:story:gen`.
 */
import { test } from '@playwright/test';
import { ucCreateRoom } from '../uc/uc-create-room';
import { ucShareInviteLink } from '../uc/uc-share-invite-link';
import { ucJoinByLink } from '../uc/uc-join-by-link';
import { ucMemberCannotControl } from '../uc/negative/uc-member-cannot-control';
import { createStoryContext, disposeStoryContext } from '../uc/context';

test.describe('two people estimate — negatives', () => {
	test('a member cannot drive host-only controls', async ({ browser }) => {
		const ctx = await createStoryContext(browser);
		try {
			await test.step('createRoom', () => ucCreateRoom.run(ctx));
			await test.step('shareInviteLink', () => ucShareInviteLink.run(ctx));
			await test.step('joinByLink', () => ucJoinByLink.run(ctx));
			await test.step('memberCannotControl', () => ucMemberCannotControl.run(ctx));
		} finally {
			await disposeStoryContext(ctx);
		}
	});
});
