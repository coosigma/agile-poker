import { attemptJoinByRoomCode, expect } from '../../utils/app';
import type { UseCase } from '../context';

/**
 * NEGATIVE use-case (auto-generated, reviewed).
 *
 * Door-specific to the room-code entry: submitting an empty room code must be
 * rejected client-side — the app shows an error and does not proceed to the
 * name step. (The backend treats every well-formed code as an existing room, so
 * "wrong code" has no rejection path; the real guard here is the empty input.)
 * No setup is required.
 */
export const ucEmptyRoomCode: UseCase = {
	id: 'emptyRoomCode',
	description:
		'Submitting an empty room code is rejected: an error is shown and no room is entered.',
	from: 'anonymousHome',
	to: 'anonymousHome',
	async run(ctx) {
		const error = await attemptJoinByRoomCode(ctx.teammate, '');
		expect(error).toContain('Please enter a room ID');
		// Still not in any room.
		expect(new URL(ctx.teammate.url()).searchParams.get('room')).toBeNull();
	},
};
