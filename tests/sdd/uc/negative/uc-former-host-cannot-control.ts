import {
	expect,
	numericCard,
	resetRoundButton,
	revealButton,
	startRoundButton,
} from '../../utils/app';
import type { UseCase } from '../context';

/** NEGATIVE UC: after host transfer, the former host cannot drive host controls. */
export const ucFormerHostCannotControl: UseCase = {
	id: 'formerHostCannotControl',
	description:
		'After transferring host status away, the former host no longer sees host-only controls and voting remains disabled before the new host opens a round.',
	from: 'hostTransferred',
	to: 'hostTransferred',
	async run(ctx) {
		await expect(startRoundButton(ctx.host)).toBeHidden();
		await expect(resetRoundButton(ctx.host)).toBeHidden();
		await expect(revealButton(ctx.host)).toBeHidden();
		await expect(numericCard(ctx.host, ctx.state.hostVote)).toBeDisabled();
	},
};
