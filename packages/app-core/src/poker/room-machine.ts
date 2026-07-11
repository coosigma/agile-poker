import { createMachine, transition } from 'xstate';

export const ROOM_STATES = ['empty', 'active'] as const;

export type RoomMachineState = (typeof ROOM_STATES)[number];

export type RoomMachineEvent =
	| { readonly type: 'JOIN' }
	| { readonly type: 'LEAVE' }
	| { readonly type: 'ROOM_EMPTIED' };

export const roomMachine = createMachine({
	id: 'room',
	initial: 'empty',
	states: {
		empty: {
			on: {
				JOIN: 'active',
			},
		},
		active: {
			on: {
				JOIN: 'active',
				LEAVE: 'active',
				ROOM_EMPTIED: 'empty',
			},
		},
	},
});

function isRoomMachineState(value: unknown): value is RoomMachineState {
	return (
		typeof value === 'string' && ROOM_STATES.some((state) => state === value)
	);
}

export function transitionRoomState(
	state: RoomMachineState,
	event: RoomMachineEvent,
): RoomMachineState {
	const snapshot = roomMachine.resolveState({ value: state, context: {} });
	const [next] = transition(roomMachine, snapshot, event);
	if (!isRoomMachineState(next.value)) {
		throw new Error(`Unexpected room machine state: ${String(next.value)}`);
	}
	return next.value;
}
