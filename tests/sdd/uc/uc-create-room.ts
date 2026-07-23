import {
	createRoomAsHost,
	expect,
	roleBadge,
	switchSelfRole,
} from '../utils/app';
import type { UseCase } from './context';

/** UC: the host creates a fresh room, then joins the voting table as player. */
export const ucCreateRoom: UseCase = {
	id: 'createRoom',
	description:
		'The host creates a fresh room as Observer by default, then switches to Player for estimation.',
	from: 'anonymousHome',
	to: 'inRoomAsHost',
	async run(ctx) {
		const roomId = await createRoomAsHost(ctx.host, ctx.state.hostName);
		ctx.state.roomId = roomId;
		await expect(roleBadge(ctx.host)).toHaveAttribute(
			'aria-label',
			'Host · Observer',
		);
		await switchSelfRole(ctx.host, 'Player');
		await expect(roleBadge(ctx.host)).toHaveAttribute(
			'aria-label',
			'Host · Player',
		);
	},
};
