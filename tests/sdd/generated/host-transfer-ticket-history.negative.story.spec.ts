/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Auto-generated NEGATIVE cases for the host-transfer-ticket-history story (reviewed
 * before commit). Implied by the machine / story — NOT written into the .md.
 * Re-run `pnpm test:story:gen`.
 */
import { test } from '@playwright/test';
import { ucCreateRoom } from '../uc/uc-create-room';
import { ucShareInviteLink } from '../uc/uc-share-invite-link';
import { ucJoinByLink } from '../uc/uc-join-by-link';
import { ucTransferHost } from '../uc/uc-transfer-host';
import { ucFormerHostCannotControl } from '../uc/negative/uc-former-host-cannot-control';
import { createStoryContext, disposeStoryContext } from '../uc/context';

test.describe('host transfer ticket history — negatives', () => {
	test('a former host cannot drive host-only controls after transfer', async ({ browser }) => {
		const ctx = await createStoryContext(browser);
		try {
			await test.step('createRoom', () => ucCreateRoom.run(ctx));
			await test.step('shareInviteLink', () => ucShareInviteLink.run(ctx));
			await test.step('joinByLink', () => ucJoinByLink.run(ctx));
			await test.step('transferHost', () => ucTransferHost.run(ctx));
			await test.step('formerHostCannotControl', () => ucFormerHostCannotControl.run(ctx));
		} finally {
			await disposeStoryContext(ctx);
		}
	});
});
