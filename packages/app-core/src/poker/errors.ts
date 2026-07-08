import { Data } from 'effect';

/**
 * Raised when an inbound client frame cannot be decoded into a valid
 * `ClientMessage` at the WebSocket boundary. Modeled as a typed value (errors
 * are values) rather than a thrown exception, so
 * adapters can branch on it instead of catching stringly-typed failures.
 */
export class InvalidMessage extends Data.TaggedError('InvalidMessage')<{
	readonly reason: string;
}> {}
