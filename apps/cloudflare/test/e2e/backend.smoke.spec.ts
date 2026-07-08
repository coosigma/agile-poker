import { expect, test } from '@playwright/test';
import {
	connectRoom,
	uniqueRoomId,
	type ServerFrame,
} from './helpers/room-socket';

/**
 * backend node smoke — the deployed Worker boundary over real transport.
 *
 * A node smoke asserts node-intrinsic realism only: the real wrangler Worker
 * completes a WebSocket handshake and decodes frames at its boundary, replying
 * with an `error` over a live socket — the one thing the in-process integration
 * doubles cannot vouch for. The exhaustive boundary matrix (peer isolation,
 * disconnect leave, fan-out, pre-join drop, empty-room reuse) lives in the
 * cloudflare integration suite (`apps/cloudflare/test/room-object.int.test.ts`).
 * See tests/CONTRACT.md → node smoke / backend.
 */

const isError = (frame: ServerFrame) => frame.type === 'error';

test('the real worker rejects a malformed frame with an error', async () => {
	const roomId = uniqueRoomId('SMOKE');
	const client = await connectRoom(roomId);

	try {
		client.sendRaw('this is not json');
		const error = await client.waitFor(isError, 'malformed error');
		expect(error).toMatchObject({
			type: 'error',
			message: 'Malformed JSON payload',
		});
	} finally {
		await client.close();
	}
});
