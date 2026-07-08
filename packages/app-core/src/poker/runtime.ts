import { ManagedRuntime } from 'effect';
import { makeRoomStoreLayer } from './room-store.js';
import type { RoomState } from './types.js';

/**
 * Build a runtime for a single room. A plain server assembles one
 * `ManagedRuntime` at module load; a Durable Object instead builds one per
 * instance so each room owns an isolated Ref-backed store. Adapters run use
 * cases through this instead of rebuilding Layers per message.
 */
export const makeRoomRuntime = (initial: RoomState) =>
	ManagedRuntime.make(makeRoomStoreLayer(initial));

export type RoomRuntime = ReturnType<typeof makeRoomRuntime>;
