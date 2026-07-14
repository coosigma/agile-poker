import type { NegativeScenario } from '../lib/generate-story.mts';

export const negativeScenarios: readonly NegativeScenario[] = [
	{
		id: 'former-host-cannot-control',
		title: 'a former host cannot drive host-only controls after transfer',
		setup: ['createRoom', 'shareInviteLink', 'joinByLink', 'transferHost'],
		negative: {
			id: 'formerHostCannotControl',
			importName: 'ucFormerHostCannotControl',
			importPath: '../uc/negative/uc-former-host-cannot-control',
			from: 'hostTransferred',
			to: 'hostTransferred',
			description:
				'After transferring host status away, the former host cannot drive host-only controls.',
		},
	},
];
