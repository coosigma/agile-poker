import type { UseCaseManifestEntry } from '../lib/generate-story.mts';

/**
 * Pure-data catalogue of the story's use-cases. The generator (`generate.mts`)
 * loads this together with `machine.ts` to emit the committed spec, without
 * importing Playwright or the UC bodies. Keep `id`/`from`/`to` in sync with
 * `machine.ts` and each `uc-*.ts` file. The `UseCaseManifestEntry` type is owned
 * by the generator engine (`../lib/generate-story.mts`).
 */
export const ucManifest: readonly UseCaseManifestEntry[] = [
	{
		id: 'createRoom',
		importName: 'ucCreateRoom',
		importPath: '../uc/uc-create-room',
		from: 'anonymousHome',
		to: 'inRoomAsHost',
		description: 'The host creates a fresh room and lands in it shown as Host.',
	},
	{
		id: 'shareInviteLink',
		importName: 'ucShareInviteLink',
		importPath: '../uc/uc-share-invite-link',
		from: 'inRoomAsHost',
		to: 'linkShared',
		description: 'The host copies the room invite link.',
	},
	{
		id: 'joinByLink',
		importName: 'ucJoinByLink',
		importPath: '../uc/uc-join-by-link',
		from: 'linkShared',
		to: 'bothInRoom',
		description:
			'A teammate opens the invite link, joins the same room as Member, and sees host controls as read-only.',
	},
	{
		id: 'startRound',
		importName: 'ucStartRound',
		importPath: '../uc/uc-start-round',
		from: 'bothInRoom',
		to: 'roundOpen',
		description:
			'The host starts the round, opening voting so both people can vote.',
	},
	{
		id: 'castVotes',
		importName: 'ucCastVotes',
		importPath: '../uc/uc-cast-votes',
		from: 'roundOpen',
		to: 'votesCast',
		description: 'The host and the teammate each cast a different estimate.',
	},
	{
		id: 'revealVotes',
		importName: 'ucRevealVotes',
		importPath: '../uc/uc-reveal-votes',
		from: 'votesCast',
		to: 'revealed',
		description:
			'The host reveals the votes; both browsers show the same consistent average.',
	},
	{
		id: 'startNewRound',
		importName: 'ucStartNewRound',
		importPath: '../uc/uc-start-new-round',
		from: 'revealed',
		to: 'cleared',
		description:
			'The host starts a new round; votes clear and voting reopens for both people.',
	},
];
