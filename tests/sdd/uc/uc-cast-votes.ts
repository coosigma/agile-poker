import { castNumericVote, expect, participantVoteValue } from '../utils/app';
import type { UseCase } from './context';

/** UC: the host and the teammate each cast a different estimate. */
export const ucCastVotes: UseCase = {
	id: 'castVotes',
	description: 'The host and the teammate each cast a different estimate.',
	from: 'roundOpen',
	to: 'votesCast',
	async run(ctx) {
		await castNumericVote(ctx.host, ctx.state.hostVote);
		await castNumericVote(ctx.teammate, ctx.state.teammateVote);

		// Both browsers agree that everyone has voted (values still hidden).
		await expect(participantVoteValue(ctx.host, ctx.state.hostName)).toHaveText(
			'Voted',
		);
		await expect(
			participantVoteValue(ctx.host, ctx.state.teammateName),
		).toHaveText('Voted');
		await expect(
			participantVoteValue(ctx.teammate, ctx.state.hostName),
		).toHaveText('Voted');
		await expect(
			participantVoteValue(ctx.teammate, ctx.state.teammateName),
		).toHaveText('Voted');
	},
};
