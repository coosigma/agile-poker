import {
	expect,
	numericCard,
	revealButton,
	startNewRoundButton,
} from '../../utils/app';
import type { UseCase } from '../context';

/**
 * NEGATIVE use-case (auto-generated, reviewed).
 *
 * Implied by the machine: `startRound`, `revealVotes` and `startNewRound` are
 * host-only transitions. A Member must not be able to drive them. Precondition
 * is the `bothInRoom` state (host + teammate joined, before the round opens);
 * the teammate's host controls must be read-only and the vote cards inert.
 */
export const ucMemberCannotControl: UseCase = {
	id: 'memberCannotControl',
	description:
		'A Member cannot drive host-only controls: start-round, reveal, and voting stay disabled for the teammate.',
	from: 'bothInRoom',
	to: 'bothInRoom',
	async run(ctx) {
		await expect(startNewRoundButton(ctx.teammate)).toBeDisabled();
		await expect(revealButton(ctx.teammate)).toBeDisabled();
		// Voting has not been opened by the host, so cards are inert for the member.
		await expect(
			numericCard(ctx.teammate, ctx.state.teammateVote),
		).toBeDisabled();
	},
};
