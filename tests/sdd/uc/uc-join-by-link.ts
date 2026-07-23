import {
	expect,
	joinByInviteLink,
	revealButton,
	roleBadge,
	startRoundButton,
	resetRoundButton,
} from '../utils/app';
import type { UseCase } from './context';

/** UC: a teammate opens the invite link and joins the same room as a Player. */
export const ucJoinByLink: UseCase = {
	id: 'joinByLink',
	description:
		'A teammate opens the invite link, joins the same room as Player, and does not see host controls.',
	from: 'linkShared',
	to: 'bothInRoom',
	async run(ctx) {
		if (!ctx.state.inviteUrl) {
			throw new Error('joinByLink precondition: inviteUrl is not set');
		}
		await joinByInviteLink(
			ctx.teammate,
			ctx.state.inviteUrl,
			ctx.state.teammateName,
		);

		// Same room as the host.
		expect(new URL(ctx.teammate.url()).searchParams.get('room')).toBe(
			ctx.state.roomId,
		);
		await expect(roleBadge(ctx.teammate)).toHaveAttribute(
			'aria-label',
			'Player',
		);

		// Host controls are not available to the teammate.
		await expect(startRoundButton(ctx.teammate)).toBeHidden();
		await expect(resetRoundButton(ctx.teammate)).toBeHidden();
		await expect(revealButton(ctx.teammate)).toBeHidden();
	},
};
