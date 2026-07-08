/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Generated from tests/sdd/two-people-estimate-by-code/two-people-estimate-by-code.md
 * via tests/sdd/two-people-estimate-by-code/generate.mts (state coverage over
 * tests/sdd/two-people-estimate-by-code/machine.ts). Re-run `pnpm test:story:gen`
 * after editing the story, the machine, or the use-cases.
 *
 * Journey (state coverage — single terminal path):
 *   anonymousHome → inRoomAsHost
 *   inRoomAsHost → codeShared
 *   codeShared → bothInRoom
 *   bothInRoom → roundOpen
 *   roundOpen → votesCast
 *   votesCast → revealed
 *   revealed → cleared
 */
import { test } from '@playwright/test';
import { ucCreateRoom } from '../uc/uc-create-room';
import { ucShareRoomCode } from '../uc/uc-share-room-code';
import { ucJoinByCode } from '../uc/uc-join-by-code';
import { ucStartRound } from '../uc/uc-start-round';
import { ucCastVotes } from '../uc/uc-cast-votes';
import { ucRevealVotes } from '../uc/uc-reveal-votes';
import { ucStartNewRound } from '../uc/uc-start-new-round';
import { createStoryContext, disposeStoryContext } from '../uc/context';

test('two people estimate together via a room code', async ({ browser }) => {
	const ctx = await createStoryContext(browser);
	try {
		await test.step('createRoom', () => ucCreateRoom.run(ctx));
		await test.step('shareRoomCode', () => ucShareRoomCode.run(ctx));
		await test.step('joinByCode', () => ucJoinByCode.run(ctx));
		await test.step('startRound', () => ucStartRound.run(ctx));
		await test.step('castVotes', () => ucCastVotes.run(ctx));
		await test.step('revealVotes', () => ucRevealVotes.run(ctx));
		await test.step('startNewRound', () => ucStartNewRound.run(ctx));
	} finally {
		await disposeStoryContext(ctx);
	}
});
