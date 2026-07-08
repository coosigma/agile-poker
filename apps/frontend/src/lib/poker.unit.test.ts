import { describe, expect, test } from 'vitest';
import { layoutSeats, seatScale } from './poker';

/**
 * Unit — round-table seat layout geometry.
 *
 * Covers the two properties the seating algorithm must guarantee for large
 * rooms: a monotonic size taper (`seatScale`) and even spacing around the
 * ellipse (`layoutSeats` distributes by arc length, not by angle).
 */

const CENTER = 50;
const RADIUS_X = 40;
const RADIUS_Y = 33;

function neighbourGaps(total: number): number[] {
	const seats = layoutSeats(total);
	const gaps: number[] = [];
	for (let i = 0; i < seats.length; i += 1) {
		const a = seats[i];
		const b = seats[(i + 1) % seats.length];
		gaps.push(Math.hypot(a.left - b.left, a.top - b.top));
	}
	return gaps;
}

describe('seatScale', () => {
	test('is full size for small rooms', () => {
		for (const n of [1, 4, 8]) {
			expect(seatScale(n)).toBe(1);
		}
	});

	test('is monotonically non-increasing as the room grows', () => {
		let previous = seatScale(1);
		for (let n = 2; n <= 60; n += 1) {
			const current = seatScale(n);
			expect(current).toBeLessThanOrEqual(previous);
			previous = current;
		}
	});

	test('never drops below the readable floor', () => {
		for (const n of [30, 40, 100]) {
			expect(seatScale(n)).toBeGreaterThanOrEqual(0.42);
		}
	});
});

describe('layoutSeats', () => {
	test('returns nothing for an empty room', () => {
		expect(layoutSeats(0)).toEqual([]);
	});

	test('places a single participant at the top of the ring', () => {
		const [seat] = layoutSeats(1);
		expect(seat.left).toBeCloseTo(CENTER, 5);
		expect(seat.top).toBeCloseTo(CENTER - RADIUS_Y, 5);
	});

	test('produces one distinct in-bounds seat per participant', () => {
		const seats = layoutSeats(24);
		expect(seats).toHaveLength(24);
		for (const seat of seats) {
			expect(seat.left).toBeGreaterThanOrEqual(CENTER - RADIUS_X - 0.01);
			expect(seat.left).toBeLessThanOrEqual(CENTER + RADIUS_X + 0.01);
			expect(seat.top).toBeGreaterThanOrEqual(CENTER - RADIUS_Y - 0.01);
			expect(seat.top).toBeLessThanOrEqual(CENTER + RADIUS_Y + 0.01);
		}
		const keys = new Set(
			seats.map((s) => `${s.left.toFixed(3)},${s.top.toFixed(3)}`),
		);
		expect(keys.size).toBe(24);
	});

	test('starts at the top and runs clockwise', () => {
		const seats = layoutSeats(12);
		expect(seats[0].left).toBeCloseTo(CENTER, 5);
		expect(seats[0].top).toBeCloseTo(CENTER - RADIUS_Y, 5);
		// Next seat is to the right of centre (clockwise from 12 o'clock).
		expect(seats[1].left).toBeGreaterThan(CENTER);
	});

	test('spaces seats evenly by arc length (no pole bunching)', () => {
		for (const total of [8, 12, 24]) {
			const gaps = neighbourGaps(total);
			const max = Math.max(...gaps);
			const min = Math.min(...gaps);
			// Equal-arc distribution keeps neighbour chord lengths close; equal-angle
			// on this ellipse would spread them much wider.
			expect(max / min).toBeLessThan(1.35);
		}
	});

	test('stays evenly spread in pixel space for a wide frame', () => {
		const aspect = 2.6; // frame much wider than tall
		const seats = layoutSeats(24, aspect);
		const gaps: number[] = [];
		for (let i = 0; i < seats.length; i += 1) {
			const a = seats[i];
			const b = seats[(i + 1) % seats.length];
			// Convert percentage coords to pixel-proportional space (x weighted by
			// aspect) before measuring neighbour distance.
			gaps.push(Math.hypot((a.left - b.left) * aspect, a.top - b.top));
		}
		const max = Math.max(...gaps);
		const min = Math.min(...gaps);
		expect(max / min).toBeLessThan(1.35);
	});
});
