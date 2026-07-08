import { clickStartRound, expect, numericCard } from '../utils/app';
import type { UseCase } from './context';

/**
 * UC: the host starts the round, opening voting for everyone. In the app the
 * button that opens the first round is the same "Start new round" control.
 */
export const ucStartRound: UseCase = {
	id: 'startRound',
	description:
		'The host starts the round, opening voting so both people can vote.',
	from: 'bothInRoom',
	to: 'roundOpen',
	async run(ctx) {
		await clickStartRound(ctx.host);
		await expect(numericCard(ctx.host, ctx.state.hostVote)).toBeEnabled();
		await expect(
			numericCard(ctx.teammate, ctx.state.teammateVote),
		).toBeEnabled();
	},
};
