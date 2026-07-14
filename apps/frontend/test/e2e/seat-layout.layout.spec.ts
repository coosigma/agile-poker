import { expect, test, type Locator } from '@playwright/test';

// A roomy desktop viewport so the round table renders at production-like size.
test.use({ viewport: { width: 1600, height: 1000 } });

/**
 * Round-table seating layout — geometry check.
 *
 * Drives the real `RoomScreen` through the frontend playground's `?seats=N`
 * crowd override (deterministic, no worker) and verifies the seating algorithm
 * (`layoutSeats` + `seatScale`) keeps a busy room readable:
 *
 *   1. no two seat cards overlap, and
 *   2. seats are spread evenly around the ellipse (no bunching).
 *
 * A full-page screenshot is captured per crowd size in `test-results/` for
 * visual review. This project is local/pre-push only (never remote CI).
 */

interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Rectangles overlap when they intersect on both axes beyond a small slack. */
function overlaps(a: Box, b: Box, slack = 6): boolean {
	return (
		a.x < b.x + b.width - slack &&
		b.x < a.x + a.width - slack &&
		a.y < b.y + b.height - slack &&
		b.y < a.y + a.height - slack
	);
}

function center(box: Box): { cx: number; cy: number } {
	return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

async function readSeatBoxes(seats: Locator): Promise<Box[]> {
	const count = await seats.count();
	const boxes: Box[] = [];
	for (let i = 0; i < count; i += 1) {
		const box = await seats.nth(i).boundingBox();
		if (box) {
			boxes.push(box);
		}
	}
	return boxes;
}

const CROWD_SIZES = [6, 12, 20, 30];

for (const seats of CROWD_SIZES) {
	test(`seats do not overlap and stay evenly spread with ${seats} guests`, async ({
		page,
	}, testInfo) => {
		// crowd(N) seeds a player host + N guests; the previewed "You" client also joins.
		// Player hosts are seated at the reserved 12 o'clock table position.
		const expectedSeats = seats + 2;

		await page.goto(`/playground.html?seats=${seats}`);

		const seatCards = page.locator(
			'.seat-card:not(.host-card):not(.observer-card)',
		);
		await expect(seatCards).toHaveCount(expectedSeats);
		// Let positions settle before measuring (two animation frames instead of a
		// fixed sleep, which is deterministic across machines).
		await page.evaluate(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
				}),
		);

		await page.screenshot({
			path: testInfo.outputPath(`seats-${seats}.png`),
			fullPage: true,
		});

		const boxes = await readSeatBoxes(seatCards);
		expect(boxes).toHaveLength(expectedSeats);

		// 1. No overlapping seat cards.
		const collisions: string[] = [];
		for (let i = 0; i < boxes.length; i += 1) {
			for (let j = i + 1; j < boxes.length; j += 1) {
				if (overlaps(boxes[i], boxes[j])) {
					collisions.push(`${i}↔${j}`);
				}
			}
		}
		expect(
			collisions,
			`overlapping seat pairs: ${collisions.join(', ')}`,
		).toEqual([]);

		// 2. Even spread: order seats by angle around the table centroid, then
		// compare neighbour centre-to-centre distances. Even distribution keeps
		// them within a modest ratio (equal-angle bunching would blow this up).
		const centers = boxes.map(center);
		const cx = centers.reduce((sum, c) => sum + c.cx, 0) / centers.length;
		const cy = centers.reduce((sum, c) => sum + c.cy, 0) / centers.length;
		const ordered = centers
			.map((c) => ({ ...c, angle: Math.atan2(c.cy - cy, c.cx - cx) }))
			.sort((a, b) => a.angle - b.angle);

		const gaps: number[] = [];
		for (let i = 0; i < ordered.length; i += 1) {
			const a = ordered[i];
			const b = ordered[(i + 1) % ordered.length];
			gaps.push(Math.hypot(a.cx - b.cx, a.cy - b.cy));
		}
		const maxGap = Math.max(...gaps);
		const minGap = Math.min(...gaps);
		// Pixel space includes the frame's aspect stretch, so this is looser than
		// the pure-geometry unit test; it still catches gross clustering.
		expect(maxGap / minGap).toBeLessThan(3);
	});
}
