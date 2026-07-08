import { expect, readRoomCode, roomCodeLabel } from '../utils/app';
import type { UseCase } from './context';

/**
 * UC: the host reads the room code shown in the room, ready to pass it on.
 * The code the host reads must match the room they created.
 */
export const ucShareRoomCode: UseCase = {
	id: 'shareRoomCode',
	description: 'The host reads the room code from the room to share it.',
	from: 'inRoomAsHost',
	to: 'codeShared',
	async run(ctx) {
		if (!ctx.state.roomId) {
			throw new Error('shareRoomCode precondition: roomId is not set');
		}
		await expect(roomCodeLabel(ctx.host)).toContainText(ctx.state.roomId);
		const code = await readRoomCode(ctx.host);
		expect(code).toBe(ctx.state.roomId);
	},
};
