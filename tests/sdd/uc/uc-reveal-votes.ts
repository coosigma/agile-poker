import { averageValue, clickReveal, expect } from '../utils/app';
import type { UseCase } from './context';

/**
 * UC: the host reveals the votes; both browsers show the same overall average.
 * The expected value is derived from the story's vote values so the assertion
 * stays correct if those values change (e.g. 3 and 5 → 4.00).
 */
export const ucRevealVotes: UseCase = {
	id: 'revealVotes',
	description:
		'The host reveals the votes; both browsers show the same consistent average.',
	from: 'votesCast',
	to: 'revealed',
	async run(ctx) {
		const expectedAverage = (
			(Number(ctx.state.hostVote) + Number(ctx.state.teammateVote)) /
			2
		).toFixed(1);
		await clickReveal(ctx.host);
		await expect(averageValue(ctx.host)).toHaveText(expectedAverage);
		await expect(averageValue(ctx.teammate)).toHaveText(expectedAverage);
	},
};
