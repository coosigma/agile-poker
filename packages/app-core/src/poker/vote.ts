import { NUMERIC_CARD_VALUES, type VoteChoice } from './types.js';

/**
 * Language-neutral label for a cast vote, e.g. `5♭`, `13♯`, `?`, `∞`.
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
 * (`?`, `∞`) contribute no numeric value.
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
