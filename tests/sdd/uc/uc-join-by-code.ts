import {
	expect,
	joinByRoomCode,
	revealButton,
	roleBadge,
	startRoundButton,
	resetRoundButton,
} from '../utils/app';
import type { UseCase } from './context';

/** UC: a teammate types the room code and joins the same room as a Player. */
export const ucJoinByCode: UseCase = {
	id: 'joinByCode',
	description:
		'A teammate joins by typing the room code, lands in the same room as Player, and does not see host controls.',
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
		await expect(roleBadge(ctx.teammate)).toHaveText('Player');

		// Host controls are not available to the teammate.
		await expect(startRoundButton(ctx.teammate)).toBeHidden();
		await expect(resetRoundButton(ctx.teammate)).toBeHidden();
		await expect(revealButton(ctx.teammate)).toBeHidden();
	},
};
