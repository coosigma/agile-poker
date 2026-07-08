import { copyInviteLink, expect } from '../utils/app';
import type { UseCase } from './context';

/** UC: the host copies the room invite link to share it. */
export const ucShareInviteLink: UseCase = {
	id: 'shareInviteLink',
	description: 'The host copies the room invite link.',
	from: 'inRoomAsHost',
	to: 'linkShared',
	async run(ctx) {
		if (!ctx.state.roomId) {
			throw new Error('shareInviteLink precondition: roomId is not set');
		}
		const inviteUrl = await copyInviteLink(ctx.host, ctx.state.roomId);
		expect(inviteUrl).toContain(`room=${ctx.state.roomId}`);
		ctx.state.inviteUrl = inviteUrl;
	},
};
