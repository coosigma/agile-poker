import {
	averageValue,
	clickReveal,
	expect,
	participantVoteValue,
	revealButton,
	stdDevValue,
	votesValue,
} from '../utils/app';
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
		const hostVote = Number(ctx.state.hostVote);
		const teammateVote = Number(ctx.state.teammateVote);
		const mean = (hostVote + teammateVote) / 2;
		const expectedAverage = mean.toFixed(1);
		const expectedStdDev = Math.sqrt(
			((hostVote - mean) ** 2 + (teammateVote - mean) ** 2) / 2,
		).toFixed(1);

		await expect(
			participantVoteValue(ctx.host, ctx.state.teammateName),
		).toHaveText('Voted');
		await expect(
			participantVoteValue(ctx.teammate, ctx.state.hostName),
		).toHaveText('Voted');
		await expect(revealButton(ctx.host)).toBeEnabled();

		await clickReveal(ctx.host);
		for (const page of [ctx.host, ctx.teammate]) {
			await expect(votesValue(page)).toHaveText('2');
			await expect(averageValue(page)).toHaveText(expectedAverage);
			await expect(stdDevValue(page)).toHaveText(expectedStdDev);
			await expect(participantVoteValue(page, ctx.state.hostName)).toHaveText(
				ctx.state.hostVote,
			);
			await expect(
				participantVoteValue(page, ctx.state.teammateName),
			).toHaveText(ctx.state.teammateVote);
		}
	},
};
