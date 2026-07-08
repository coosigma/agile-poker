import { Effect } from 'effect';
import { RoomStore } from './room-store.js';
import {
	applyClientMessage,
	leaveRoom,
	toRoomStateView,
} from './room-state.js';
import type { ClientMessage, RoomStateView } from './types.js';

/**
 * Pure use cases: they orchestrate the RoomStore service and the pure domain
 * transitions, staying free of any transport concern. Each requires a
 * `RoomStore` from the environment, provided by a Layer at the edge (see
 * `runtime.ts`). Mutations go through `store.update`, whose atomic read-modify-
 * write keeps interleaved fibers from losing updates.
 */

/** Apply a decoded client message and return the resulting client-facing view. */
export const applyMessage = (
	participantId: string,
	message: ClientMessage,
): Effect.Effect<RoomStateView, never, RoomStore> =>
	Effect.gen(function* () {
		const store = yield* RoomStore;
		const next = yield* store.update((state) =>
			applyClientMessage(state, participantId, message),
		);
		return toRoomStateView(next);
	});

/** Remove a participant (on disconnect) and return the updated view. */
export const leave = (
	participantId: string,
): Effect.Effect<RoomStateView, never, RoomStore> =>
	Effect.gen(function* () {
		const store = yield* RoomStore;
		const next = yield* store.update((state) =>
			leaveRoom(state, participantId),
		);
		return toRoomStateView(next);
	});

/** Read the current client-facing view without mutating state. */
export const roomView: Effect.Effect<RoomStateView, never, RoomStore> =
	Effect.gen(function* () {
		const store = yield* RoomStore;
		return toRoomStateView(yield* store.get);
	});

/** Set the room's public id and return the stored value. */
export const setRoomId = (
	roomId: string,
): Effect.Effect<string, never, RoomStore> =>
	Effect.gen(function* () {
		const store = yield* RoomStore;
		const next = yield* store.update((state) => ({ ...state, roomId }));
		return next.roomId;
	});
