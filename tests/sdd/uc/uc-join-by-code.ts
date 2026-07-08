import {
	expect,
	joinByRoomCode,
	revealButton,
	roleBadge,
	startNewRoundButton,
} from '../utils/app';
import type { UseCase } from './context';

/** UC: a teammate types the room code and joins the same room as a Member. */
export const ucJoinByCode: UseCase = {
	id: 'joinByCode',
	description:
		'A teammate joins by typing the room code, lands in the same room as Member, and sees host controls as read-only.',
	from: 'codeShared',
	to: 'bothInRoom',
	async run(ctx) {
		if (!ctx.state.roomId) {
			throw new Error('joinByCode precondition: roomId is not set');
		}
		await joinByRoomCode(
			ctx.teammate,
			ctx.state.roomId,
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
