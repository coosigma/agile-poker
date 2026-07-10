import { describe, expect, test } from 'vitest';
import { voteLabel, voteNumericValue } from './vote.js';

describe('voteLabel', () => {
	test('renders estimates with modifier glyphs', () => {
		expect(voteLabel({ kind: 'estimate', base: '5', modifier: 'base' })).toBe(
			'5',
		);
		expect(voteLabel({ kind: 'estimate', base: '5', modifier: 'flat' })).toBe(
			'5♭',
		);
		expect(voteLabel({ kind: 'estimate', base: '8', modifier: 'sharp' })).toBe(
			'8♯',
		);
	});

	test('renders special cards verbatim', () => {
		expect(voteLabel({ kind: 'special', value: '?' })).toBe('?');
		expect(voteLabel({ kind: 'special', value: '∞' })).toBe('∞');
	});
});

describe('voteNumericValue', () => {
	test('returns the base value without a modifier', () => {
		expect(
			voteNumericValue({ kind: 'estimate', base: '5', modifier: 'base' }),
		).toBe(5);
	});

	test('flat nudges half-way toward the previous card', () => {
		// previous of 5 is 3 -> (3 + 5) / 2
		expect(
			voteNumericValue({ kind: 'estimate', base: '5', modifier: 'flat' }),
		).toBe(4);
	});

	test('sharp nudges half-way toward the next card', () => {
		// next of 5 is 8 -> (5 + 8) / 2
		expect(
			voteNumericValue({ kind: 'estimate', base: '5', modifier: 'sharp' }),
		).toBe(6.5);
	});

	test('clamps at the sequence boundaries', () => {
		expect(
			voteNumericValue({ kind: 'estimate', base: '0', modifier: 'flat' }),
		).toBe(0);
		expect(
			voteNumericValue({ kind: 'estimate', base: '34', modifier: 'sharp' }),
		).toBe(34);
	});

	test('special cards and empty votes have no numeric value', () => {
		expect(voteNumericValue({ kind: 'special', value: '?' })).toBeNull();
		expect(voteNumericValue(null)).toBeNull();
	});
});
