import {
	NUMERIC_CARD_VALUES,
	type Participant,
	type VoteChoice,
} from './types.js';

/**
 * Language-neutral label for a cast vote, e.g. `5♭`, `13♯`, `?`, `☕`.
 * The "not voted" fallback is a presentation concern and is handled by the UI.
 */
export function voteLabel(vote: VoteChoice): string {
	if (vote.kind === 'special') {
		return vote.value;
	}
	const suffix =
		vote.modifier === 'flat' ? '♭' : vote.modifier === 'sharp' ? '♯' : '';
	return `${vote.base}${suffix}`;
}

/**
 * Numeric value used for the arithmetic average. `flat`/`sharp` modifiers nudge
 * the estimate half-way toward the neighbouring Fibonacci card. Special cards
 * (`?`, `☕`) contribute no numeric value.
 */
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

export interface VoteBreakdownItem {
	readonly label: string;
	readonly count: number;
	/** Percentage share of valid votes, rounded to an integer string. */
	readonly ratio: string;
}

export interface RevealStats {
	/** Arithmetic average of numeric votes, `"N/A"` when there are none. */
	readonly average: string;
	readonly totalVotes: number;
	readonly breakdown: readonly VoteBreakdownItem[];
}

/**
 * Compute the reveal-phase statistics: overall arithmetic average, valid vote
 * count, and a frequency breakdown sorted by count then label.
 */
export function computeRevealStats(
	participants: readonly Participant[],
): RevealStats {
	const buckets = new Map<string, number>();
	const numericVotes: number[] = [];
	let totalVotes = 0;

	for (const participant of participants) {
		if (!participant.vote) {
			continue;
		}
		totalVotes += 1;
		const label = voteLabel(participant.vote);
		buckets.set(label, (buckets.get(label) ?? 0) + 1);

		const numericValue = voteNumericValue(participant.vote);
		if (numericValue !== null) {
			numericVotes.push(numericValue);
		}
	}

	const average =
		numericVotes.length > 0
			? (
					numericVotes.reduce((sum, value) => sum + value, 0) /
					numericVotes.length
				).toFixed(2)
			: 'N/A';

	const breakdown = [...buckets.entries()]
		.map(([label, count]) => ({
			label,
			count,
			ratio: totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(0) : '0',
		}))
		.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

	return { average, totalVotes, breakdown };
}
