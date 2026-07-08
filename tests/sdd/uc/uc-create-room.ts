import { createRoomAsHost, expect, roleBadge } from '../utils/app';
import type { UseCase } from './context';

/** UC: the host creates a fresh room and lands in it as Host. */
export const ucCreateRoom: UseCase = {
	id: 'createRoom',
	description: 'The host creates a fresh room and lands in it shown as Host.',
	from: 'anonymousHome',
	to: 'inRoomAsHost',
	async run(ctx) {
		const roomId = await createRoomAsHost(ctx.host, ctx.state.hostName);
		ctx.state.roomId = roomId;
		await expect(roleBadge(ctx.host)).toHaveText('Host');
	},
};
