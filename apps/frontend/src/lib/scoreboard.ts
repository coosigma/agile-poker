import type { Participant, VotingMachineState } from '../types';
import { voteNumericValue } from './poker';

export interface ScoreboardStats {
	readonly revealed: boolean;
	readonly totalVotes: number;
	readonly mean: string;
	readonly stdDev: string;
}

export function computeScoreboardStats(
	participants: readonly Participant[],
	votingState: VotingMachineState | undefined,
): ScoreboardStats {
	const revealed = votingState === 'revealed';
	const numericVotes: number[] = [];
	let totalVotes = 0;

	if (revealed) {
		for (const participant of participants) {
			if (participant.vote !== null) {
				totalVotes += 1;
			}
			const numericValue = voteNumericValue(participant.vote);
			if (numericValue !== null) {
				numericVotes.push(numericValue);
			}
		}
	}

	const mean =
		numericVotes.length > 0
			? numericVotes.reduce((sum, value) => sum + value, 0) /
				numericVotes.length
			: 0;

	const stdDev =
		numericVotes.length > 0
			? Math.sqrt(
					numericVotes.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
						numericVotes.length,
				)
			: 0;

	return {
		revealed,
		totalVotes,
		mean: numericVotes.length > 0 ? mean.toFixed(1) : '0',
		stdDev: numericVotes.length > 0 ? stdDev.toFixed(1) : '0',
	};
}
