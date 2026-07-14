import {
	expect,
	revealButton,
	roleBadge,
	startRoundButton,
	transferHostTo,
} from '../utils/app';
import type { UseCase } from './context';

/** UC: the host transfers host status to the teammate without changing roles. */
export const ucTransferHost: UseCase = {
	id: 'transferHost',
	description:
		'The host transfers host status to the teammate; controls move to the new host while roles stay unchanged.',
	from: 'bothInRoom',
	to: 'hostTransferred',
	async run(ctx) {
		await transferHostTo(ctx.host, ctx.state.teammateName);

		await expect(roleBadge(ctx.host)).toHaveText('Player');
		await expect(roleBadge(ctx.teammate)).toHaveText('Host · Player');
		await expect(startRoundButton(ctx.host)).toBeHidden();
		await expect(revealButton(ctx.host)).toBeHidden();
		await expect(startRoundButton(ctx.teammate)).toBeVisible();
	},
};
