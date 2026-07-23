import {
	clickStartRound,
	expect,
	numericCard,
	participantVoteValue,
} from '../utils/app';
import type { UseCase } from './context';

/**
 * UC: the host starts a new round after a reveal, clearing votes and reopening
 * voting. This is the story's terminal state.
 */
export const ucStartNewRound: UseCase = {
	id: 'startNewRound',
	description:
		'The host starts a new round; votes clear and voting reopens for both people.',
	from: 'revealed',
	to: 'cleared',
	async run(ctx) {
		await clickStartRound(ctx.host);

		// Votes are cleared and voting is open again in both browsers.
		await expect(participantVoteValue(ctx.host, ctx.state.hostName)).toHaveText(
			'Not voted',
		);
		await expect(
			participantVoteValue(ctx.host, ctx.state.teammateName),
		).toHaveText('Not voted');
		await expect(
			participantVoteValue(ctx.teammate, ctx.state.hostName),
		).toHaveText('Not voted');
		await expect(
			participantVoteValue(ctx.teammate, ctx.state.teammateName),
		).toHaveText('Not voted');
		await expect(numericCard(ctx.host, ctx.state.hostVote)).toBeEnabled();
		await expect(
			numericCard(ctx.teammate, ctx.state.teammateVote),
		).toBeEnabled();
	},
};
