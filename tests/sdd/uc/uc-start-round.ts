import { clickStartRound, expect, numericCard, setTicket } from '../utils/app';
import type { UseCase } from './context';

/**
 * UC: the host starts the round, opening voting for everyone. The host first
 * sets a ticket (required before the round can open), then clicks the "Start
 * new round" control.
 */
export const ucStartRound: UseCase = {
	id: 'startRound',
	description:
		'The host starts the round, opening voting so both people can vote.',
	from: 'bothInRoom',
	to: 'roundOpen',
	async run(ctx) {
		await setTicket(ctx.host, ctx.state.ticket);
		await clickStartRound(ctx.host);
		await expect(numericCard(ctx.host, ctx.state.hostVote)).toBeEnabled();
		await expect(
			numericCard(ctx.teammate, ctx.state.teammateVote),
		).toBeEnabled();
	},
};
