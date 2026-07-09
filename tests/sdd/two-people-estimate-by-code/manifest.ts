import { ucManifest } from '../uc/manifest.ts';
import type { UseCaseManifestEntry } from '../lib/generate-story.mts';

/**
 * Use-case catalogue for the `two-people-estimate-by-code` story. It REUSES the
 * shared use-cases whose behaviour is identical to the invite-link story
 * (create-room, start-round, cast-votes, reveal-votes, start-new-round) and adds
 * only the two door-specific ones (share-room-code, join-by-code). Their
 * `from`/`to` states match `machine.ts`.
 */
const sharedIds = [
	'createRoom',
	'startRound',
	'castVotes',
	'revealVotes',
	'startNewRound',
];
const shared = ucManifest.filter((uc) => sharedIds.includes(uc.id));

const doorSpecific: readonly UseCaseManifestEntry[] = [
	{
		id: 'shareRoomCode',
		importName: 'ucShareRoomCode',
		importPath: '../uc/uc-share-room-code',
		from: 'inRoomAsHost',
		to: 'codeShared',
		description: 'The host reads the room code from the room to share it.',
	},
	{
		id: 'joinByCode',
		importName: 'ucJoinByCode',
		importPath: '../uc/uc-join-by-code',
		from: 'codeShared',
		to: 'bothInRoom',
		description:
			'A teammate joins by typing the room code, lands in the same room as Member, and does not see host controls.',
	},
];

export const ucManifestByCode: readonly UseCaseManifestEntry[] = [
	...shared,
	...doorSpecific,
];
