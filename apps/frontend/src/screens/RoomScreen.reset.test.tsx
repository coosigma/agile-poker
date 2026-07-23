import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { MockWebSocket } from '../test/mock-websocket';
import type { RoomState } from '../types';
import { RoomScreen } from './RoomScreen';

/**
 * Regression coverage for the Reset-gating bug fixed in this change: the host
 * must be able to reset a round immediately after starting it, before anyone
 * has voted. `canResetRound` previously required `votedCount > 0`, which kept
 * the Reset button disabled right after `Start`.
 */

const originalWebSocket = globalThis.WebSocket;

function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
	return {
		roomId: 'ABC',
		roomName: '',
		roomState: 'active',
		votingState: 'voting',
		revealCountdownEndsAt: null,
		ticketTitle: 'Some ticket',
		completedRounds: [],
		participants: [
			{
				id: 's1',
				name: 'Ada',
				role: 'player',
				vote: null,
				hasVoted: false,
				connected: true,
				isHost: true,
			},
		],
		...overrides,
	};
}

beforeEach(() => {
	MockWebSocket.reset();
	(globalThis as { WebSocket: unknown }).WebSocket =
		MockWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
	cleanup();
	(globalThis as { WebSocket: unknown }).WebSocket = originalWebSocket;
});

describe('RoomScreen reset gating', () => {
	test('enables Reset right after starting a round with zero votes cast', () => {
		render(
			<RoomScreen
				language="en"
				setLanguage={() => {}}
				roomId="ABC"
				name="Ada"
				onBackHome={() => {}}
			/>,
		);

		act(() => MockWebSocket.latest().emitOpen());
		act(() =>
			MockWebSocket.latest().emitMessage({
				type: 'room_state',
				state: makeRoomState({ votingState: 'voting' }),
				selfId: 's1',
			}),
		);

		const resetButton = screen.getByRole('button', {
			name: 'Reset',
		}) as HTMLButtonElement;
		expect(resetButton.disabled).toBe(false);
	});
});
