import {
	type CSSProperties,
	type FormEvent,
	useEffect,
	useRef,
	useState,
} from 'react';
import { InfoTip } from '../components/InfoTip';
import { LanguageSelector } from '../components/LanguageSelector';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { STRINGS, type Language } from '../lib/i18n';
import { computeScoreboardStats } from '../lib/scoreboard';
import {
	getVotingStateLabel,
	layoutSeats,
	roomShareUrl,
	voteLabel,
} from '../lib/poker';
import {
	MODIFIER_OPTIONS,
	NUMERIC_CARD_VALUES,
	SPECIAL_CARD_VALUES,
	type VoteModifier,
} from '../types';

interface RoomScreenProps {
	readonly language: Language;
	readonly setLanguage: (language: Language) => void;
	readonly roomId: string;
	readonly name: string;
}

export function RoomScreen({
	language,
	setLanguage,
	roomId,
	name,
}: RoomScreenProps) {
	const copy = STRINGS[language];
	const { state, selfId, socketStatus, connectionNotice, error, sendMessage } =
		useRoomSocket({ enabled: true, roomId, name, language });

	const [ticketDraft, setTicketDraft] = useState('');
	const [modifier, setModifier] = useState<VoteModifier>('base');
	const [pendingControl, setPendingControl] = useState<
		'reset' | 'reveal' | 'done' | null
	>(null);

	// Seats are distributed by pixel arc length, which needs the table frame's
	// aspect ratio (width / height). Measure it and keep it current on resize.
	const tableFrameRef = useRef<HTMLDivElement | null>(null);
	const [frameAspect, setFrameAspect] = useState(1);
	useEffect(() => {
		const frame = tableFrameRef.current;
		if (!frame || typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			if (width > 0 && height > 0) {
				setFrameAspect(width / height);
			}
		});
		observer.observe(frame);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (state) {
			setTicketDraft(state.ticketTitle);
		}
	}, [state?.ticketTitle]);

	const self =
		state?.participants.find((participant) => participant.id === selfId) ??
		null;
	const isHost = Boolean(self?.isHost);
	const participants = state?.participants ?? [];
	const completedRounds = state?.completedRounds ?? [];
	const connectedCount = participants.filter(
		(participant) => participant.connected,
	).length;
	const votedCount = participants.filter(
		(participant) => participant.hasVoted,
	).length;
	const savedTicketTitle = state?.ticketTitle ?? '';
	const ticketDraftValue = ticketDraft.trim();
	const hasUnsavedTicketChange = ticketDraftValue !== savedTicketTitle;
	const hasSavedTicket = Boolean(savedTicketTitle.trim());
	const canEditTicket =
		state?.votingState === 'noTopic' ||
		state?.votingState === 'ready' ||
		state?.votingState === 'completed';
	const canUpdateTicket = canEditTicket && hasUnsavedTicketChange;
	const canStartRound =
		Boolean(state) &&
		(state?.votingState === 'noTopic' ||
			state?.votingState === 'ready' ||
			state?.votingState === 'completed') &&
		Boolean(ticketDraftValue);
	const canResetRound =
		Boolean(state) &&
		!hasUnsavedTicketChange &&
		(state?.votingState === 'voting' || state?.votingState === 'revealed') &&
		votedCount > 0;
	const canRevealVotes = state?.votingState === 'voting' && votedCount > 0;
	const canDoneTicket =
		hasSavedTicket &&
		!hasUnsavedTicketChange &&
		state?.votingState === 'revealed';

	const stats = computeScoreboardStats(participants, state?.votingState);

	useEffect(() => {
		if (
			(pendingControl === 'reset' && !canResetRound) ||
			(pendingControl === 'reveal' && !canRevealVotes) ||
			(pendingControl === 'done' && !canDoneTicket)
		) {
			setPendingControl(null);
		}
	}, [canDoneTicket, canResetRound, canRevealVotes, pendingControl]);

	const handleTicketSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (!canUpdateTicket) {
			return;
		}
		sendMessage({ type: 'set_ticket', ticketTitle: ticketDraftValue });
	};

	const handleStartRound = () => {
		if (!canStartRound) {
			return;
		}
		if (hasUnsavedTicketChange) {
			sendMessage({ type: 'set_ticket', ticketTitle: ticketDraftValue });
		}
		sendMessage({ type: 'start_round' });
	};

	const handleResetRound = () => {
		if (!canResetRound) {
			return;
		}
		setPendingControl('reset');
	};

	const handleRevealVotes = () => {
		if (!canRevealVotes) {
			return;
		}
		setPendingControl('reveal');
	};

	const handleDoneTicket = () => {
		if (!canDoneTicket) {
			return;
		}
		setPendingControl('done');
	};

	const handleConfirmControl = () => {
		if (pendingControl === 'reset' && canResetRound) {
			sendMessage({ type: 'start_round' });
		}
		if (pendingControl === 'reveal' && canRevealVotes) {
			sendMessage({ type: 'reveal_votes' });
		}
		if (pendingControl === 'done' && canDoneTicket) {
			sendMessage({ type: 'done_ticket' });
		}
		setPendingControl(null);
	};

	const seatLayouts = layoutSeats(participants.length, frameAspect);
	const seats = participants.map((participant, index) => ({
		participant,
		...seatLayouts[index],
	}));

	const confirmPrompt =
		pendingControl === 'reset'
			? copy.resetRoundConfirm
			: pendingControl === 'done'
				? copy.doneTicketConfirm
				: null;

	return (
		<div className="app-shell room-shell">
			<section className="topbar">
				<div>
					<p className="eyebrow">{copy.roomLabel}</p>
					<h2 className="room-title">{roomId}</h2>
				</div>
				<div className="topbar-actions">
					<LanguageSelector
						language={language}
						setLanguage={setLanguage}
						compact
					/>
					<div className="status-pill">
						<span className={`status-dot ${socketStatus}`}></span>
						<span>
							{socketStatus === 'open'
								? copy.statusOnline
								: socketStatus === 'connecting'
									? copy.statusConnecting
									: copy.statusClosed}
						</span>
					</div>
					<button
						className="secondary-button"
						onClick={async () => {
							await navigator.clipboard.writeText(roomShareUrl(roomId));
						}}
					>
						{copy.copyInvite}
					</button>
				</div>
			</section>
			{connectionNotice ? (
				<p className="error-text center-text">{connectionNotice}</p>
			) : null}

			<section className="room-layout">
				<aside className="side-panel">
					<div className="panel">
						<div className="panel-header">
							<h3>{copy.roomInfo}</h3>
							<span className="badge">
								{connectedCount} {copy.connected}
							</span>
						</div>
						<div className="meta-list">
							<div>
								<span>{copy.currentVotingState}</span>
								<strong>
									{getVotingStateLabel(
										language,
										state?.votingState ?? 'noTopic',
									)}
								</strong>
							</div>
							<div>
								<span>{copy.voted}</span>
								<strong>
									{votedCount}/{participants.length}
								</strong>
							</div>
							<div>
								<span>{copy.myRole}</span>
								<strong>{isHost ? copy.host : copy.member}</strong>
							</div>
						</div>
					</div>

					{isHost ? (
						<div className="panel">
							<div className="panel-header">
								<h3>{copy.hostControls}</h3>
								<div className="ticket-history-actions">
									<button
										className="ticket-history-button"
										type="button"
										aria-label={copy.previousTicket}
										disabled
									>
										‹
									</button>
									<button
										className="ticket-history-button"
										type="button"
										aria-label={copy.nextTicket}
										disabled
									>
										›
									</button>
								</div>
							</div>
							<form
								className="stack host-ticket-form"
								onSubmit={handleTicketSubmit}
							>
								<div className="ticket-input-row">
									<label className="ticket-input-label">
										<input
											value={ticketDraft}
											onChange={(event) => setTicketDraft(event.target.value)}
											aria-label={copy.currentTicket}
											placeholder={copy.ticketPlaceholder}
											maxLength={40}
										/>
									</label>
									<button
										className="ticket-submit-button"
										type="submit"
										aria-label={copy.updateTicket}
										disabled={!canUpdateTicket}
									>
										✓
									</button>
								</div>
							</form>
							<div className="control-pad" aria-label={copy.hostControls}>
								<button
									className="control-pad-button control-pad-start secondary-button"
									type="button"
									disabled={!canStartRound}
									onClick={handleStartRound}
								>
									<span className="control-pad-label">{copy.startRound}</span>
								</button>
								<button
									className="control-pad-button control-pad-reset secondary-button"
									type="button"
									disabled={!canResetRound}
									onClick={handleResetRound}
								>
									<span className="control-pad-label">{copy.resetRound}</span>
								</button>
								<button
									className={`control-pad-center ${pendingControl ? 'pending' : ''}`}
									type="button"
									disabled={!pendingControl}
									aria-label={copy.confirmAction}
									title={confirmPrompt ?? undefined}
									onClick={handleConfirmControl}
								>
									{pendingControl ? 'OK?' : copy.confirmAction}
								</button>
								<button
									className="control-pad-button control-pad-reveal secondary-button"
									type="button"
									disabled={!canRevealVotes}
									onClick={handleRevealVotes}
								>
									<span className="control-pad-label">{copy.reveal}</span>
								</button>
								<button
									className="control-pad-button control-pad-done primary-button"
									type="button"
									disabled={!canDoneTicket}
									onClick={handleDoneTicket}
								>
									<span className="control-pad-label">{copy.doneTicket}</span>
								</button>
							</div>
						</div>
					) : null}

					<div className="panel completed-rounds-panel">
						<div className="panel-header">
							<h3>{copy.completedTickets}</h3>
							<span className="badge muted-badge">
								{completedRounds.length}
							</span>
						</div>
						{completedRounds.length > 0 ? (
							<div className="completed-rounds-list">
								{[...completedRounds].reverse().map((round, index) => (
									<article
										className="completed-round-card"
										key={`${round.ticketTitle}-${completedRounds.length - index}`}
									>
										<div className="completed-round-title">
											<strong>{round.ticketTitle}</strong>
											<span>
												{round.votes.length} {copy.statVotes}
											</span>
										</div>
										<div className="completed-votes">
											{round.votes.map((completedVote) => (
												<span
													className="completed-vote-pill"
													key={`${round.ticketTitle}-${completedVote.participantId}`}
												>
													{completedVote.participantName}:{' '}
													{voteLabel(completedVote.vote, language)}
												</span>
											))}
										</div>
									</article>
								))}
							</div>
						) : (
							<p className="empty-panel-copy">{copy.noCompletedTickets}</p>
						)}
					</div>
				</aside>

				<main className="table-zone">
					<div className="table-frame" ref={tableFrameRef}>
						<div className="ellipse-table">
							<div className="table-center">
								<p>{copy.revealTable}</p>
								<strong
									style={{
										fontSize: `clamp(1rem, ${Math.min(2.2, 40 / Math.max((state?.ticketTitle || copy.waitingTopic).length, 1))}rem, 2.2rem)`,
									}}
								>
									{state?.ticketTitle || copy.waitingTopic}
								</strong>
								<div
									className={`scoreboard ${stats.revealed ? 'revealed' : 'pending'}`}
								>
									<div className="scoreboard-cell">
										<span className="scoreboard-value">{stats.totalVotes}</span>
										<span className="scoreboard-label">{copy.statVotes}</span>
									</div>
									<div className="scoreboard-cell">
										<span className="scoreboard-value">{stats.mean}</span>
										<span className="scoreboard-label">{copy.statMean}</span>
									</div>
									<div className="scoreboard-cell">
										<span className="scoreboard-value">{stats.stdDev}</span>
										<span className="scoreboard-label">{copy.statStdDev}</span>
									</div>
								</div>
							</div>
						</div>
						{seats.map(({ participant, left, top, scale }) => (
							<article
								key={participant.id}
								className={`seat-card ${participant.id === selfId ? 'self' : ''} ${scale < 0.7 ? 'compact' : ''}`}
								style={
									{
										left: `${left}%`,
										top: `${top}%`,
										'--seat-scale': scale,
									} as CSSProperties
								}
							>
								<span className="seat-name">
									{participant.name}
									{participant.isHost ? ` · ${copy.participantHost}` : ''}
								</span>
								<strong>
									{state?.votingState === 'revealed'
										? voteLabel(participant.vote, language)
										: participant.hasVoted
											? copy.votedYes
											: copy.voteNotCast}
								</strong>
								<small>
									{participant.connected ? copy.online : copy.offline}
								</small>
							</article>
						))}
					</div>
				</main>

				<aside className="side-panel">
					<div className="panel">
						<div className="panel-header">
							<h3>{copy.voteCards}</h3>
							<span className="badge muted-badge">
								{voteLabel(self?.vote ?? null, language)}
							</span>
						</div>
						<div className="modifier-section">
							<div className="modifier-header">
								<strong>{copy.optionalModifier}</strong>
								<InfoTip
									label={copy.optionalModifier}
									text={copy.optionalModifierHelp}
								/>
							</div>
							<div className="modifier-row">
								{MODIFIER_OPTIONS.map((option) => (
									<button
										key={option}
										type="button"
										className={`modifier-button ${modifier === option ? 'active' : ''}`}
										aria-label={
											option === 'flat'
												? copy.modifierFlat
												: option === 'sharp'
													? copy.modifierSharp
													: copy.modifierBase
										}
										onClick={() => setModifier(option)}
									>
										{option === 'flat' ? '♭' : option === 'sharp' ? '♯' : '♮'}
									</button>
								))}
							</div>
						</div>
						<div className="points-header">
							<strong>{copy.pointsTitle}</strong>
						</div>
						<div className="card-grid">
							{NUMERIC_CARD_VALUES.map((value) => {
								const active =
									self?.vote?.kind === 'estimate' &&
									self.vote.base === value &&
									self.vote.modifier === modifier;
								return (
									<button
										key={value}
										type="button"
										className={`vote-card ${active ? 'active' : ''}`}
										disabled={state?.votingState !== 'voting'}
										onClick={() =>
											sendMessage({
												type: 'vote',
												vote: {
													kind: 'estimate',
													base: value,
													modifier,
												},
											})
										}
									>
										<span>{value}</span>
										{modifier !== 'base' ? (
											<small>{modifier === 'flat' ? '♭' : '♯'}</small>
										) : null}
									</button>
								);
							})}
						</div>
						<div className="special-card-row">
							{SPECIAL_CARD_VALUES.map((value) => {
								const active =
									self?.vote?.kind === 'special' && self.vote.value === value;
								return (
									<button
										key={value}
										type="button"
										className={`vote-card special-card ${active ? 'active' : ''}`}
										disabled={state?.votingState !== 'voting'}
										onClick={() =>
											sendMessage({
												type: 'vote',
												vote: {
													kind: 'special',
													value,
												},
											})
										}
									>
										{value}
									</button>
								);
							})}
						</div>
						<button
							className="vote-card clear-card"
							type="button"
							disabled={state?.votingState !== 'voting'}
							onClick={() => sendMessage({ type: 'clear_vote' })}
						>
							{copy.clearVote}
						</button>
					</div>
				</aside>
			</section>
			{error ? <p className="error-text center-text">{error}</p> : null}
		</div>
	);
}
