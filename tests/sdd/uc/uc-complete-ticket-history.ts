import {
	castNumericVote,
	castNumericVoteWithModifier,
	clickDone,
	clickReveal,
	clickStartRound,
	expect,
	newerTicketButton,
	olderTicketButton,
	setTicket,
	ticketHistorySelfVote,
	ticketHistoryStat,
	ticketHistoryTitle,
} from '../utils/app';
import type { Page } from '@playwright/test';
import type { UseCase } from './context';

const ROUND_1_TICKET = 'PAY-101 Login form';
const ROUND_2_TICKET = 'PAY-102 Checkout flow';

async function completeFirstRound(newHost: Page, formerHost: Page) {
	await setTicket(newHost, ROUND_1_TICKET);
	await clickStartRound(newHost);
	await castNumericVote(newHost, '5');
	await castNumericVote(formerHost, '8');
	await clickReveal(newHost);
	await clickDone(newHost);
}

async function completeSecondRound(newHost: Page, formerHost: Page) {
	await setTicket(newHost, ROUND_2_TICKET);
	await clickStartRound(newHost);
	await castNumericVoteWithModifier(newHost, '3', 'More');
	await castNumericVote(formerHost, '5');
	await clickReveal(newHost);
	await clickDone(newHost);
}

async function expectHistoryRound1(page: Page) {
	await expect(ticketHistoryTitle(page)).toHaveText(ROUND_1_TICKET);
	await expect(ticketHistoryStat(page, 'Votes')).toHaveText('2');
	await expect(ticketHistoryStat(page, 'Mean')).toHaveText('6.5');
	await expect(ticketHistoryStat(page, 'Std dev')).toHaveText('1.5');
}

async function expectHistoryRound2(page: Page) {
	await expect(ticketHistoryTitle(page)).toHaveText(ROUND_2_TICKET);
	await expect(ticketHistoryStat(page, 'Votes')).toHaveText('2');
	await expect(ticketHistoryStat(page, 'Mean')).toHaveText('4.5');
	await expect(ticketHistoryStat(page, 'Std dev')).toHaveText('0.5');
	await expect(ticketHistorySelfVote(page)).toContainText('You:');
	await expect(ticketHistorySelfVote(page)).toContainText('3♯');
}

/** UC: the new host completes two tickets and verifies Tickets history. */
export const ucCompleteTicketHistory: UseCase = {
	id: 'completeTicketHistory',
	description:
		'The transferred host completes two tickets; Tickets history shows latest first, stats, self vote, and older/newer navigation.',
	from: 'hostTransferred',
	to: 'historyVerified',
	async run(ctx) {
		const newHost = ctx.teammate;
		const formerHost = ctx.host;

		await completeFirstRound(newHost, formerHost);
		await expectHistoryRound1(newHost);

		await completeSecondRound(newHost, formerHost);
		await expectHistoryRound2(newHost);

		await olderTicketButton(newHost).click();
		await expectHistoryRound1(newHost);
		await newerTicketButton(newHost).click();
		await expectHistoryRound2(newHost);
	},
};
