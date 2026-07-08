import type { NegativeScenario } from '../lib/generate-story.mts';

/**
 * Auto-generated NEGATIVE scenarios for the room-code story (reviewed before
 * commit). `empty-room-code` needs no setup: the teammate submits the join
 * form with an empty code and must be rejected client-side.
 */
export const negativeScenariosByCode: readonly NegativeScenario[] = [
	{
		id: 'empty-room-code',
		title: 'an empty room code is rejected',
		setup: [],
		negative: {
			id: 'emptyRoomCode',
			importName: 'ucEmptyRoomCode',
			importPath: '../uc/negative/uc-empty-room-code',
			from: 'anonymousHome',
			to: 'anonymousHome',
			description:
				'Submitting an empty room code is rejected: an error is shown and no room is entered.',
		},
	},
];
