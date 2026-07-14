/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Generated from tests/sdd/host-transfer-ticket-history/host-transfer-ticket-history.md
 * via tests/sdd/host-transfer-ticket-history/generate.mts (state coverage over
 * tests/sdd/host-transfer-ticket-history/machine.ts). Re-run `pnpm test:story:gen`
 * after editing the story, the machine, or the use-cases.
 *
 * Journey (state coverage — single terminal path):
 *   anonymousHome → inRoomAsHost
 *   inRoomAsHost → linkShared
 *   linkShared → bothInRoom
 *   bothInRoom → hostTransferred
 *   hostTransferred → historyVerified
 */
import { test } from '@playwright/test';
import { ucCreateRoom } from '../uc/uc-create-room';
import { ucShareInviteLink } from '../uc/uc-share-invite-link';
import { ucJoinByLink } from '../uc/uc-join-by-link';
import { ucTransferHost } from '../uc/uc-transfer-host';
import { ucCompleteTicketHistory } from '../uc/uc-complete-ticket-history';
import { createStoryContext, disposeStoryContext } from '../uc/context';

test('host transfers control and the new host completes ticket history', async ({ browser }) => {
	const ctx = await createStoryContext(browser);
	try {
		await test.step('createRoom', () => ucCreateRoom.run(ctx));
		await test.step('shareInviteLink', () => ucShareInviteLink.run(ctx));
		await test.step('joinByLink', () => ucJoinByLink.run(ctx));
		await test.step('transferHost', () => ucTransferHost.run(ctx));
		await test.step('completeTicketHistory', () => ucCompleteTicketHistory.run(ctx));
	} finally {
		await disposeStoryContext(ctx);
	}
});
