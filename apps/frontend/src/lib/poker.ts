import { NUMERIC_CARD_VALUES, type RoomState, type VoteChoice } from '../types';
import { STRINGS, type Language } from './i18n';

const DEFAULT_NAME = '';
const NAME_KEY = 'agile-poker:name';
const ROOM_INTENT_KEY = 'agile-poker:room-intent';

export type RoomIntentType = 'create' | 'join';

export function getInitialName(): string {
	return window.localStorage.getItem(NAME_KEY) ?? DEFAULT_NAME;
}

export function persistName(name: string): void {
	window.localStorage.setItem(NAME_KEY, name);
}

export function randomRoomId(): string {
	return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function getRoomIdFromUrl(): string {
	const url = new URL(window.location.href);
	return url.searchParams.get('room')?.trim().toUpperCase() ?? '';
}

export function updateRoomInUrl(roomId: string): void {
	const url = new URL(window.location.href);
	if (roomId) {
		url.searchParams.set('room', roomId);
	} else {
		url.searchParams.delete('room');
	}
	window.history.pushState({}, '', url);
}

export function getRoomIntent(
	roomId: string,
): { roomId: string; type: RoomIntentType } | null {
	if (!roomId) {
		return null;
	}
	const raw = window.sessionStorage.getItem(ROOM_INTENT_KEY);
	if (!raw) {
		return null;
	}
	try {
		const value = JSON.parse(raw) as { roomId: string; type: RoomIntentType };
		return value.roomId === roomId ? value : null;
	} catch {
		return null;
	}
}

export function setRoomIntent(roomId: string, type: RoomIntentType): void {
	window.sessionStorage.setItem(
		ROOM_INTENT_KEY,
		JSON.stringify({ roomId, type }),
	);
}

export function clearRoomIntent(): void {
	window.sessionStorage.removeItem(ROOM_INTENT_KEY);
}

export function voteLabel(vote: VoteChoice | null, language: Language): string {
	if (!vote) {
		return STRINGS[language].voteNotCast;
	}
	if (vote.kind === 'special') {
		return vote.value;
	}
	const suffix =
		vote.modifier === 'flat' ? '♭' : vote.modifier === 'sharp' ? '♯' : '';
	return `${vote.base}${suffix}`;
}

export function voteNumericValue(vote: VoteChoice | null): number | null {
	if (!vote || vote.kind !== 'estimate') {
		return null;
	}
	const sequence = NUMERIC_CARD_VALUES.map((value) => Number(value));
	const currentIndex = NUMERIC_CARD_VALUES.indexOf(vote.base);
	if (currentIndex === -1) {
		return null;
	}
	const currentValue = sequence[currentIndex];
	if (vote.modifier === 'flat') {
		const previousValue = sequence[Math.max(0, currentIndex - 1)];
		return (previousValue + currentValue) / 2;
	}
	if (vote.modifier === 'sharp') {
		const nextValue = sequence[Math.min(sequence.length - 1, currentIndex + 1)];
		return (currentValue + nextValue) / 2;
	}
	return currentValue;
}

export function getVotingStateLabel(
	language: Language,
	votingState: RoomState['votingState'],
): string {
	const copy = STRINGS[language];
	if (votingState === 'voting') {
		return copy.stageVoting;
	}
	if (votingState === 'countdown') {
		return copy.stageCountdown;
	}
	if (votingState === 'revealed') {
		return copy.stageRevealed;
	}
	if (votingState === 'completed') {
		return copy.doneTicket;
	}
	return copy.stageWaiting;
}

const SEAT_RADIUS_X = 40;
const SEAT_RADIUS_Y = 33;
const SEAT_CENTER = 50;
/** Above this many participants seat cards start scaling down to avoid overlap. */
const SEAT_SCALE_FROM = 8;
const SEAT_SCALE_MIN = 0.42;
const SEAT_SCALE_STEP = 0.03;

export interface SeatLayout {
	readonly left: number;
	readonly top: number;
	readonly scale: number;
}

/**
 * Size multiplier for a seat card given the crowd size. Full size for small
 * rooms, then a monotonic taper (floored) so a busy ring stops cards from
 * colliding. Exposed as a CSS variable (`--seat-scale`) by the room screen.
 */
export function seatScale(total: number): number {
	if (total <= SEAT_SCALE_FROM) {
		return 1;
	}
	const scaled = 1 - (total - SEAT_SCALE_FROM) * SEAT_SCALE_STEP;
	return Math.max(SEAT_SCALE_MIN, Number(scaled.toFixed(3)));
}

/**
 * Place `total` seats around the room ellipse.
 *
 * Seats are distributed by **equal arc length in rendered pixels** (not equal
 * angle): equal-angle steps bunch points near the poles of a non-circular
 * ellipse, and because the table frame is usually far wider than it is tall,
 * equalising arc length in percentage space still crowds the left/right sides.
 * We therefore sample the perimeter in pixel space using `aspect`
 * (frameWidth / frameHeight) and pick points at even cumulative-arc fractions,
 * then map back to percentage coordinates. Seat 0 sits at the top (12 o'clock)
 * and the ring runs clockwise.
 *
 * Coordinates are percentages of the table frame; pair with {@link seatScale}
 * (returned per seat) so a large crowd stays overlap-free.
 */
export function layoutSeats(total: number, aspect = 1): SeatLayout[] {
	if (total <= 0) {
		return [];
	}
	const scale = seatScale(total);
	if (total === 1) {
		return [{ left: SEAT_CENTER, top: SEAT_CENTER - SEAT_RADIUS_Y, scale }];
	}

	const START = -Math.PI / 2; // 12 o'clock
	const SAMPLES = 2048;
	// Weight x by the frame aspect so arc length reflects rendered pixels.
	const ratio = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
	const point = (t: number): { x: number; y: number } => ({
		x: SEAT_RADIUS_X * ratio * Math.cos(t),
		y: SEAT_RADIUS_Y * Math.sin(t),
	});

	// Cumulative arc length around one full turn, starting at the top.
	const cumulative = new Float64Array(SAMPLES + 1);
	let previous = point(START);
	for (let i = 1; i <= SAMPLES; i += 1) {
		const t = START + (Math.PI * 2 * i) / SAMPLES;
		const current = point(t);
		cumulative[i] =
			cumulative[i - 1] +
			Math.hypot(current.x - previous.x, current.y - previous.y);
		previous = current;
	}
	const perimeter = cumulative[SAMPLES];

	const angleAtArc = (targetArc: number): number => {
		// Binary search the sampled cumulative arc for the first index >= target.
		let lo = 0;
		let hi = SAMPLES;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (cumulative[mid] < targetArc) {
				lo = mid + 1;
			} else {
				hi = mid;
			}
		}
		return START + (Math.PI * 2 * lo) / SAMPLES;
	};

	const seats: SeatLayout[] = [];
	for (let k = 0; k < total; k += 1) {
		const angle = angleAtArc((k / total) * perimeter);
		seats.push({
			left: SEAT_CENTER + SEAT_RADIUS_X * Math.cos(angle),
			top: SEAT_CENTER + SEAT_RADIUS_Y * Math.sin(angle),
			scale,
		});
	}
	return seats;
}

export function roomShareUrl(roomId: string): string {
	return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
}
