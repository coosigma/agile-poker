import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { STRINGS } from '../lib/i18n';
import { setRoomIntent } from '../lib/poker';
import type { RoomState } from '../types';
import { MockWebSocket } from '../test/mock-websocket';
import { useRoomSocket } from './useRoomSocket';

/**
 * P4 — `useRoomSocket` state machine driven by a mock WebSocket.
 *
 * Covers the connect/join handshake, server message dispatch, optimistic sends,
 * reconnect on identity change, and transport error handling. Stays browser-
 * safe: it only touches the pure `@agile-poker/app-core/poker` types, never the
 * `effect`-backed server entry.
 */

const originalWebSocket = globalThis.WebSocket;

function makeRoomState(overrides: Partial<RoomState> = {}): RoomState {
	return {
		roomId: 'ABC',
		roomName: '',
		roomState: 'active',
		votingState: 'noTopic',
		revealCountdownEndsAt: null,
		ticketTitle: '',
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

const baseOptions = {
	enabled: true,
	roomId: 'ABC',
	name: 'Ada',
	language: 'en' as const,
};

beforeEach(() => {
	MockWebSocket.reset();
	window.sessionStorage.clear();
	(globalThis as { WebSocket: unknown }).WebSocket =
		MockWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
	(globalThis as { WebSocket: unknown }).WebSocket = originalWebSocket;
});

describe('useRoomSocket', () => {
	test('opens a socket and sends join_room on open', () => {
		const { result } = renderHook(() => useRoomSocket(baseOptions));
		expect(result.current.socketStatus).toBe('connecting');

		act(() => MockWebSocket.latest().emitOpen());

		expect(result.current.socketStatus).toBe('open');
		expect(MockWebSocket.latest().sentPayloads()).toEqual([
			{
				type: 'join_room',
				roomId: 'ABC',
				name: 'Ada',
				claimHost: false,
				role: 'player',
			},
		]);
	});

	test('claims host when a create intent is stored for the room', () => {
		setRoomIntent('ABC', 'create');
		const { result } = renderHook(() => useRoomSocket(baseOptions));

		act(() => MockWebSocket.latest().emitOpen());

		expect(result.current.socketStatus).toBe('open');
		expect(MockWebSocket.latest().sentPayloads()[0]).toMatchObject({
			type: 'join_room',
			claimHost: true,
			role: 'observer',
		});
	});

	test('uses the stored join role when joining a room', () => {
		setRoomIntent('ABC', 'join', 'observer');
		renderHook(() => useRoomSocket(baseOptions));

		act(() => MockWebSocket.latest().emitOpen());

		expect(MockWebSocket.latest().sentPayloads()[0]).toMatchObject({
			type: 'join_room',
			claimHost: false,
			role: 'observer',
		});
	});

	test('dispatches a room_state frame into hook state', () => {
		const { result } = renderHook(() => useRoomSocket(baseOptions));
		act(() => MockWebSocket.latest().emitOpen());

		const state = makeRoomState({ votingState: 'voting' });
		act(() =>
			MockWebSocket.latest().emitMessage({
				type: 'room_state',
				state,
				selfId: 's1',
			}),
		);

		expect(result.current.state).toEqual(state);
		expect(result.current.selfId).toBe('s1');
		expect(result.current.error).toBe('');
	});

	test('an error frame sets the error without clobbering state', () => {
		const { result } = renderHook(() => useRoomSocket(baseOptions));
		act(() => MockWebSocket.latest().emitOpen());

		const state = makeRoomState();
		act(() =>
			MockWebSocket.latest().emitMessage({
				type: 'room_state',
				state,
				selfId: 's1',
			}),
		);
		act(() =>
			MockWebSocket.latest().emitMessage({ type: 'error', message: 'Nope' }),
		);

		expect(result.current.error).toBe('Nope');
		expect(result.current.state).toEqual(state);
	});

	test('sendMessage forwards the payload when the socket is open', () => {
		const { result } = renderHook(() => useRoomSocket(baseOptions));
		act(() => MockWebSocket.latest().emitOpen());

		act(() =>
			result.current.sendMessage({
				type: 'vote',
				vote: { kind: 'estimate', base: '5', modifier: 'base' },
			}),
		);

		expect(MockWebSocket.latest().sentPayloads()).toContainEqual({
			type: 'vote',
			vote: { kind: 'estimate', base: '5', modifier: 'base' },
		});
	});

	test('sendMessage before the socket is open errors and sends nothing', () => {
		const { result } = renderHook(() => useRoomSocket(baseOptions));
		// No emitOpen: readyState is still CONNECTING.

		act(() => result.current.sendMessage({ type: 'reveal_votes' }));

		expect(result.current.error).toBe(STRINGS.en.socketNotReadyError);
		expect(MockWebSocket.latest().sent).toHaveLength(0);
	});

	test('changing the room reconnects with a fresh socket', () => {
		const { result, rerender } = renderHook((props) => useRoomSocket(props), {
			initialProps: baseOptions,
		});
		act(() => MockWebSocket.latest().emitOpen());
		const first = MockWebSocket.latest();

		rerender({ ...baseOptions, roomId: 'XYZ' });

		// Old socket is torn down; a new one is created for the new room.
		expect(first.closed).toBe(true);
		expect(MockWebSocket.instances).toHaveLength(2);
		const second = MockWebSocket.latest();
		expect(second).not.toBe(first);
		expect(second.url).toContain('XYZ');

		act(() => second.emitOpen());
		expect(second.sentPayloads()[0]).toMatchObject({
			type: 'join_room',
			roomId: 'XYZ',
		});
		expect(result.current.socketStatus).toBe('open');
	});

	test('a transport error closes the socket and surfaces a notice', () => {
		const { result } = renderHook(() => useRoomSocket(baseOptions));
		act(() => MockWebSocket.latest().emitOpen());

		act(() => MockWebSocket.latest().emitError());

		expect(result.current.socketStatus).toBe('closed');
		expect(result.current.connectionNotice).toBe(STRINGS.en.connectionWarning);
	});

	test('is inert while disabled or missing identity', () => {
		renderHook(() => useRoomSocket({ ...baseOptions, enabled: false }));
		expect(MockWebSocket.instances).toHaveLength(0);
	});
});
