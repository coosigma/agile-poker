import { ucManifest } from '../uc/manifest.ts';
import type { UseCaseManifestEntry } from '../lib/generate-story.mts';

const sharedIds = ['createRoom', 'shareInviteLink', 'joinByLink'];
const shared = ucManifest.filter((uc) => sharedIds.includes(uc.id));

const hostHistorySpecific: readonly UseCaseManifestEntry[] = [
	{
		id: 'transferHost',
		importName: 'ucTransferHost',
		importPath: '../uc/uc-transfer-host',
		from: 'bothInRoom',
		to: 'hostTransferred',
		description:
			'The host transfers host status to the teammate without changing participant roles.',
	},
	{
		id: 'completeTicketHistory',
		importName: 'ucCompleteTicketHistory',
		importPath: '../uc/uc-complete-ticket-history',
		from: 'hostTransferred',
		to: 'historyVerified',
		description:
			'The transferred host completes two tickets and verifies Tickets history stats and navigation.',
	},
];

export const hostTransferTicketHistoryManifest: readonly UseCaseManifestEntry[] =
	[...shared, ...hostHistorySpecific];
