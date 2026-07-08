import type { NegativeScenario } from '../../lib/generate-story.mts';

/**
 * Auto-generated NEGATIVE scenarios (reviewed before commit). Each negative is
 * a setup prefix of positive use-cases that drives the app to the negative's
 * `from` state, followed by the negative use-case that asserts the guard holds.
 * The `NegativeScenario` type is owned by the generator engine
 * (`../../lib/generate-story.mts`).
 *
 * `memberCannotControl` targets `bothInRoom` (host + teammate joined, round not
 * yet started) and checks the host-only transitions are unavailable to a Member.
 */
export const negativeScenarios: readonly NegativeScenario[] = [
	{
		id: 'member-cannot-control',
		title: 'a member cannot drive host-only controls',
		setup: ['createRoom', 'shareInviteLink', 'joinByLink'],
		negative: {
			id: 'memberCannotControl',
			importName: 'ucMemberCannotControl',
			importPath: '../uc/negative/uc-member-cannot-control',
			from: 'bothInRoom',
			to: 'bothInRoom',
			description:
				'A Member cannot drive host-only controls: start-round, reveal, and voting stay disabled for the teammate.',
		},
	},
];
