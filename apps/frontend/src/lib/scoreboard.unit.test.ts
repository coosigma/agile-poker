import { describe, expect, test } from 'vitest';
import type { Participant, VoteChoice } from '../types';
import { computeScoreboardStats } from './scoreboard';

function participant(id: string, vote: VoteChoice | null): Participant {
	return {
		id,
		name: id,
		vote,
		hasVoted: vote !== null,
		connected: true,
		isHost: false,
	};
}

describe('computeScoreboardStats', () => {
	test('computes revealed numeric vote statistics', () => {
		const stats = computeScoreboardStats(
			[
				participant('a', { kind: 'estimate', base: '5', modifier: 'base' }),
				participant('b', { kind: 'estimate', base: '8', modifier: 'base' }),
			],
			'revealed',
		);

		expect(stats).toEqual({
			revealed: true,
			totalVotes: 2,
			mean: '6.5',
			stdDev: '1.5',
		});
	});

	test('counts special cards without including them in numeric stats', () => {
		const stats = computeScoreboardStats(
			[
				participant('a', { kind: 'estimate', base: '5', modifier: 'base' }),
				participant('b', { kind: 'special', value: '?' }),
				participant('c', { kind: 'special', value: '∞' }),
				participant('d', null),
			],
			'revealed',
		);

		expect(stats).toEqual({
			revealed: true,
			totalVotes: 3,
			mean: '5.0',
			stdDev: '0.0',
		});
	});

	test('does not count votes before reveal', () => {
		const stats = computeScoreboardStats(
			[participant('a', { kind: 'estimate', base: '8', modifier: 'base' })],
			'voting',
		);

		expect(stats).toEqual({
			revealed: false,
			totalVotes: 0,
			mean: '0',
			stdDev: '0',
		});
	});

	test('reports zero values when revealed votes have no numeric values', () => {
		const stats = computeScoreboardStats(
			[participant('a', { kind: 'special', value: '∞' })],
			'revealed',
		);

		expect(stats).toEqual({
			revealed: true,
			totalVotes: 1,
			mean: '0',
			stdDev: '0',
		});
	});
});
