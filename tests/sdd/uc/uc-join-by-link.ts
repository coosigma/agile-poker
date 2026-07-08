import {
	expect,
	joinByInviteLink,
	revealButton,
	roleBadge,
	startNewRoundButton,
} from '../utils/app';
import type { UseCase } from './context';

/** UC: a teammate opens the invite link and joins the same room as a Member. */
export const ucJoinByLink: UseCase = {
	id: 'joinByLink',
	description:
		'A teammate opens the invite link, joins the same room as Member, and sees host controls as read-only.',
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
		await expect(roleBadge(ctx.teammate)).toHaveText('Member');

		// Host controls are read-only for the teammate.
		await expect(startNewRoundButton(ctx.teammate)).toBeDisabled();
		await expect(revealButton(ctx.teammate)).toBeDisabled();
	},
};
