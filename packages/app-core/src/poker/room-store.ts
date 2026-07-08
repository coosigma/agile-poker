import { Context, Effect, Layer, Ref } from 'effect';
import type { RoomState } from './types.js';

/**
 * Replaceable contract for the authoritative room state. Use cases depend on
 * this Tag, never on a concrete store, so a Durable Object (Ref-backed),
 * durable storage, or an in-memory fake can all be swapped behind it.
 */
export class RoomStore extends Context.Tag('RoomStore')<
	RoomStore,
	{
		readonly get: Effect.Effect<RoomState>;
		/**
		 * Atomically apply a pure transition and return the resulting state.
		 * Backed by `Ref.modify`, so interleaved use-case fibers (the Durable
		 * Object handles inbound frames asynchronously) can never lose an update
		 * via a read-then-write race.
		 */
		readonly update: (
			transition: (state: RoomState) => RoomState,
		) => Effect.Effect<RoomState>;
	}
>() {}

/**
 * Ref-backed live implementation, seeded with the room's initial state. Each
 * Durable Object instance builds its own Layer so the state stays isolated per
 * room while the use cases remain pure and store-agnostic.
 */
export const makeRoomStoreLayer = (
	initial: RoomState,
): Layer.Layer<RoomStore> =>
	Layer.effect(
		RoomStore,
		Effect.gen(function* () {
			const ref = yield* Ref.make(initial);
			return {
				get: Ref.get(ref),
				update: (transition: (state: RoomState) => RoomState) =>
					Ref.modify(ref, (state) => {
						const next = transition(state);
						return [next, next];
					}),
			};
		}),
	);
