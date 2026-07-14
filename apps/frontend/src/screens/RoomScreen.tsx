import {
	type CSSProperties,
	type FormEvent,
	type MouseEvent,
	useEffect,
	useRef,
	useState,
} from 'react';
import { InfoTip } from '../components/InfoTip';
import { LanguageSelector } from '../components/LanguageSelector';
import { RoomPanel } from '../components/RoomPanel';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { STRINGS, type Language } from '../lib/i18n';
import { computeScoreboardStats } from '../lib/scoreboard';
import {
	getVotingStateLabel,
	layoutSeats,
	roomShareUrl,
	voteNumericValue,
	voteLabel,
} from '../lib/poker';
import {
	MODIFIER_OPTIONS,
	NUMERIC_CARD_VALUES,
	SPECIAL_CARD_VALUES,
	type NumericCardValue,
	type SpecialCardValue,
	type VoteModifier,
	type VoteChoice,
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
	const [selectedNumericVote, setSelectedNumericVote] =
		useState<NumericCardValue | null>(null);
	const [selectedSpecialVote, setSelectedSpecialVote] =
		useState<SpecialCardValue | null>(null);
	const [pendingControl, setPendingControl] = useState<
		'reset' | 'reveal' | null
	>(null);
	const [showTicketLockedNotice, setShowTicketLockedNotice] = useState(false);
	const [now, setNow] = useState(() => Date.now());
	const [ticketHistoryIndex, setTicketHistoryIndex] = useState(0);
	const submittedVoteKeyRef = useRef<string | null>(null);

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
		const closeSeatRoleMenus = (event: PointerEvent) => {
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest('.seat-role-menu') !== null
			) {
				return;
			}
			document
				.querySelectorAll<HTMLDetailsElement>('.seat-role-menu[open]')
				.forEach((menu) => menu.removeAttribute('open'));
		};

		document.addEventListener('pointerdown', closeSeatRoleMenus);
		return () => {
			document.removeEventListener('pointerdown', closeSeatRoleMenus);
		};
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
	const hostParticipant =
		participants.find((participant) => participant.isHost) ?? null;
	const playerParticipants = participants.filter(
		(participant) => participant.role === 'player',
	);
	const observerParticipants = participants.filter(
		(participant) => participant.role === 'observer',
	);
	const seatedParticipants = playerParticipants.filter(
		(participant) => !participant.isHost,
	);
	const visibleObserverParticipants = observerParticipants.filter(
		(participant) => !participant.isHost,
	);
	const completedRounds = state?.completedRounds ?? [];
	const connectedCount = playerParticipants.filter(
		(participant) => participant.connected,
	).length;
	const votedCount = playerParticipants.filter(
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
	const isTicketLockedUntilDone =
		state?.votingState === 'countdown' || state?.votingState === 'revealed';
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
	const countdownEndsAt = state?.revealCountdownEndsAt ?? null;
	const isRevealCountdown =
		state?.votingState === 'countdown' && countdownEndsAt !== null;
	const revealCountdownSeconds = isRevealCountdown
		? Math.min(3, Math.max(1, Math.ceil((countdownEndsAt - now) / 1000)))
		: null;

	const stats = computeScoreboardStats(playerParticipants, state?.votingState);
	const isPlayer = self?.role === 'player';
	const canSelectVoteCards =
		state?.votingState === 'voting' || state?.votingState === 'countdown';
	const canSubmitVote = isPlayer && canSelectVoteCards;
	const selectedVote: VoteChoice | null = selectedSpecialVote
		? { kind: 'special', value: selectedSpecialVote }
		: selectedNumericVote !== null
			? { kind: 'estimate', base: selectedNumericVote, modifier }
			: null;
	const selectedVoteKey = selectedVote ? voteKey(selectedVote) : null;

	useEffect(() => {
		if (!isRevealCountdown) {
			return;
		}
		const initialTimer = window.setTimeout(() => {
			setNow(Date.now());
		}, 0);
		const timer = window.setInterval(() => {
			setNow(Date.now());
		}, 500);
		return () => {
			window.clearTimeout(initialTimer);
			window.clearInterval(timer);
		};
	}, [countdownEndsAt, isRevealCountdown]);

	useEffect(() => {
		if (
			(pendingControl === 'reset' && !canResetRound) ||
			(pendingControl === 'reveal' && !canRevealVotes)
		) {
			setPendingControl(null);
		}
	}, [canResetRound, canRevealVotes, pendingControl]);

	useEffect(() => {
		if (!isTicketLockedUntilDone) {
			setShowTicketLockedNotice(false);
		}
	}, [isTicketLockedUntilDone]);

	useEffect(() => {
		if (!canSelectVoteCards) {
			setSelectedNumericVote(null);
			setSelectedSpecialVote(null);
		}
	}, [canSelectVoteCards]);

	useEffect(() => {
		if (!canSubmitVote) {
			submittedVoteKeyRef.current = null;
			return;
		}
		if (!selectedVote || !selectedVoteKey) {
			return;
		}
		if (submittedVoteKeyRef.current === selectedVoteKey) {
			return;
		}
		submittedVoteKeyRef.current = selectedVoteKey;
		sendMessage({
			type: 'vote',
			vote: selectedVote,
		});
	}, [canSubmitVote, selectedVote, selectedVoteKey, sendMessage]);

	const handleTicketSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (!canUpdateTicket) {
			if (isTicketLockedUntilDone) {
				setShowTicketLockedNotice(true);
			}
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
		sendMessage({ type: 'done_ticket' });
	};

	const handleConfirmControl = () => {
		if (pendingControl === 'reset' && canResetRound) {
			sendMessage({ type: 'start_round' });
		}
		if (pendingControl === 'reveal' && canRevealVotes) {
			sendMessage({ type: 'reveal_votes' });
		}
		setPendingControl(null);
	};

	const handleClearVote = () => {
		setSelectedNumericVote(null);
		setSelectedSpecialVote(null);
		submittedVoteKeyRef.current = null;
		sendMessage({ type: 'clear_vote' });
	};

	const hostIsPlayer = hostParticipant?.role === 'player';
	const tableSeatLayouts = layoutSeats(
		seatedParticipants.length + (hostIsPlayer ? 1 : 0),
		frameAspect,
	);
	const hostSeat = hostIsPlayer ? tableSeatLayouts[0] : null;
	const seatLayouts = hostIsPlayer
		? tableSeatLayouts.slice(1)
		: tableSeatLayouts;
	const seats = seatedParticipants.map((participant, index) => ({
		participant,
		...seatLayouts[index],
	}));

	const confirmPrompt =
		pendingControl === 'reset' ? copy.resetRoundConfirm : null;
	const ticketHistory = [...completedRounds].reverse();
	const currentHistory = ticketHistory[ticketHistoryIndex] ?? null;
	const ticketHistoryActions = (
		<div className="ticket-history-actions">
			<button
				className="ticket-history-button"
				type="button"
				aria-label={copy.previousTicket}
				disabled={ticketHistoryIndex >= ticketHistory.length - 1}
				onClick={() =>
					setTicketHistoryIndex((index) =>
						Math.min(Math.max(0, ticketHistory.length - 1), index + 1),
					)
				}
			>
				‹
			</button>
			<button
				className="ticket-history-button"
				type="button"
				aria-label={copy.nextTicket}
				disabled={ticketHistoryIndex <= 0}
				onClick={() => setTicketHistoryIndex((index) => Math.max(0, index - 1))}
			>
				›
			</button>
		</div>
	);

	useEffect(() => {
		if (ticketHistoryIndex >= ticketHistory.length) {
			setTicketHistoryIndex(Math.max(0, ticketHistory.length - 1));
		}
	}, [ticketHistory.length, ticketHistoryIndex]);
	const currentHistoryNumericVotes =
		currentHistory?.votes
			.map((completedVote) => voteNumericValue(completedVote.vote))
			.filter((value): value is number => value !== null) ?? [];
	const currentHistoryMean =
		currentHistoryNumericVotes.length > 0
			? currentHistoryNumericVotes.reduce((sum, value) => sum + value, 0) /
				currentHistoryNumericVotes.length
			: 0;
	const currentHistoryStdDev =
		currentHistoryNumericVotes.length > 0
			? Math.sqrt(
					currentHistoryNumericVotes.reduce(
						(sum, value) => sum + (value - currentHistoryMean) ** 2,
						0,
					) / currentHistoryNumericVotes.length,
				)
			: 0;
	const currentHistorySelfVote =
		self?.role === 'player'
			? currentHistory?.votes.find((vote) => vote.participantId === selfId)
			: null;
	const shouldShowCurrentHistorySelfVote =
		self?.role === 'player' && Boolean(currentHistory);

	const ticketHistorySlides = (showTitle: boolean) => (
		<div className="ticket-history">
			{showTitle ? (
				<div className="ticket-history-header">
					<strong>{copy.completedTickets}</strong>
				</div>
			) : null}
			{currentHistory ? (
				<article className="completed-round-card ticket-history-slide">
					<div className="completed-round-title">
						<strong>{currentHistory.ticketTitle}</strong>
						{shouldShowCurrentHistorySelfVote ? (
							<span className="ticket-history-self-vote">
								<span>{copy.yourVote}:</span>
								<strong>
									{voteLabel(currentHistorySelfVote?.vote ?? null, language)}
								</strong>
							</span>
						) : null}
					</div>
					<div className="ticket-history-stats">
						<div>
							<strong>{currentHistory.votes.length}</strong>
							<span>{copy.statVotes}</span>
						</div>
						<div>
							<strong>
								{currentHistoryNumericVotes.length > 0
									? currentHistoryMean.toFixed(1)
									: '0'}
							</strong>
							<span>{copy.statMean}</span>
						</div>
						<div>
							<strong>
								{currentHistoryNumericVotes.length > 0
									? currentHistoryStdDev.toFixed(1)
									: '0'}
							</strong>
							<span>{copy.statStdDev}</span>
						</div>
					</div>
				</article>
			) : (
				<p className="empty-panel-copy">{copy.noCompletedTickets}</p>
			)}
		</div>
	);
	const closeRoleMenu = (event: MouseEvent<HTMLButtonElement>) => {
		event.currentTarget.closest('details')?.removeAttribute('open');
	};
	const closeOtherSeatRoleMenus = (event: MouseEvent<HTMLElement>) => {
		const currentMenu = event.currentTarget.closest('details');
		document
			.querySelectorAll<HTMLDetailsElement>('.seat-role-menu[open]')
			.forEach((menu) => {
				if (menu !== currentMenu) {
					menu.removeAttribute('open');
				}
			});
	};
	const roleMenu = (
		participantId: string,
		role: 'player' | 'observer',
		label: string,
	) => (
		<details className="seat-role-menu">
			<summary aria-label={copy.roleLabel} onClick={closeOtherSeatRoleMenus}>
				<svg
					className="seat-role-menu-icon"
					viewBox="0 0 16 16"
					aria-hidden="true"
					focusable="false"
				>
					<circle cx="8" cy="3.5" r="1.4" />
					<circle cx="8" cy="8" r="1.4" />
					<circle cx="8" cy="12.5" r="1.4" />
				</svg>
			</summary>
			<div className="seat-role-menu-popover">
				<button
					type="button"
					onClick={(event) => {
						closeRoleMenu(event);
						sendMessage({
							type: 'transfer_host',
							participantId,
						});
					}}
				>
					{copy.makeHost}
				</button>
				<button
					type="button"
					onClick={(event) => {
						closeRoleMenu(event);
						sendMessage({
							type: 'set_role',
							participantId,
							role,
						});
					}}
				>
					{label}
				</button>
			</div>
		</details>
	);

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
					<RoomPanel
						title={copy.roomInfo}
						className="room-info-panel"
						badge={
							<span className="badge">
								{connectedCount} {copy.connected}
							</span>
						}
					>
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
									{votedCount}/{playerParticipants.length}
								</strong>
							</div>
							<div>
								<strong>
									{[
										isHost ? copy.host : null,
										self?.role === 'observer'
											? copy.observerRole
											: copy.playerRole,
									]
										.filter(Boolean)
										.join(' · ')}
								</strong>
								{self ? (
									<details className="self-role-menu">
										<summary aria-label={copy.roleLabel}>
											<span>{copy.myRole}</span>
										</summary>
										<div className="self-role-menu-popover">
											<button
												type="button"
												className={self.role === 'player' ? 'active' : ''}
												onClick={(event) => {
													closeRoleMenu(event);
													sendMessage({ type: 'set_role', role: 'player' });
												}}
											>
												{copy.playerRole}
											</button>
											<button
												type="button"
												className={self.role === 'observer' ? 'active' : ''}
												onClick={(event) => {
													closeRoleMenu(event);
													sendMessage({ type: 'set_role', role: 'observer' });
												}}
											>
												{copy.observerRole}
											</button>
										</div>
									</details>
								) : (
									<span>{copy.myRole}</span>
								)}
							</div>
						</div>
					</RoomPanel>

					{isHost ? (
						<RoomPanel title={copy.hostControls} actions={ticketHistoryActions}>
							<form
								className="stack host-ticket-form"
								onSubmit={handleTicketSubmit}
							>
								<div className="ticket-input-row">
									<label className="ticket-input-label">
										<input
											value={ticketDraft}
											onChange={(event) => {
												if (canEditTicket) {
													setTicketDraft(event.target.value);
												}
											}}
											onClick={() => {
												if (isTicketLockedUntilDone) {
													setShowTicketLockedNotice(true);
												}
											}}
											onFocus={() => {
												if (isTicketLockedUntilDone) {
													setShowTicketLockedNotice(true);
												}
											}}
											aria-label={copy.currentTicket}
											placeholder={copy.ticketPlaceholder}
											readOnly={!canEditTicket}
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
								{showTicketLockedNotice ? (
									<p className="ticket-lock-notice">
										{copy.finishTicketBeforeEditing}
									</p>
								) : null}
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
							{ticketHistorySlides(true)}
						</RoomPanel>
					) : null}

					{isHost ? null : (
						<RoomPanel
							title={copy.completedTickets}
							actions={ticketHistoryActions}
							className="completed-rounds-panel"
						>
							{ticketHistorySlides(false)}
						</RoomPanel>
					)}
				</aside>

				<main className="table-zone">
					<div className="table-stack">
						{hostParticipant && !hostIsPlayer ? (
							<div className="host-board" aria-label={copy.participantHost}>
								<span className="host-board-label">{copy.participantHost}</span>
								<article
									className={`seat-card host-card ${hostParticipant.id === selfId ? 'self' : ''}`}
								>
									<span className="seat-name">{hostParticipant.name}</span>
								</article>
							</div>
						) : null}
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
											<span className="scoreboard-value">
												{stats.totalVotes}
											</span>
											<span className="scoreboard-label">{copy.statVotes}</span>
										</div>
										<div className="scoreboard-cell">
											<span className="scoreboard-value">{stats.mean}</span>
											<span className="scoreboard-label">{copy.statMean}</span>
										</div>
										<div className="scoreboard-cell">
											<span className="scoreboard-value">{stats.stdDev}</span>
											<span className="scoreboard-label">
												{copy.statStdDev}
											</span>
										</div>
									</div>
								</div>
							</div>
							{hostParticipant && hostSeat ? (
								<article
									className={`seat-card host-player-card ${hostParticipant.id === selfId ? 'self' : ''}`}
									style={
										{
											left: `${hostSeat.left}%`,
											top: `${hostSeat.top}%`,
											'--seat-scale': hostSeat.scale,
										} as CSSProperties
									}
								>
									<span className="seat-name">
										{hostParticipant.name} · {copy.participantHost}
									</span>
									<strong>
										{state?.votingState === 'revealed'
											? voteLabel(hostParticipant.vote, language)
											: hostParticipant.hasVoted
												? copy.votedYes
												: copy.voteNotCast}
									</strong>
									<small>
										{hostParticipant.connected ? copy.online : copy.offline}
									</small>
								</article>
							) : null}
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
									<span className="seat-name">{participant.name}</span>
									{isHost && participant.id !== selfId
										? roleMenu(participant.id, 'observer', copy.makeObserver)
										: null}
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
						<div className="observer-bench" aria-label={copy.observers}>
							<span className="observer-bench-label">{copy.observers}</span>
							{visibleObserverParticipants.map((participant) => (
								<article
									key={participant.id}
									className={`seat-card observer-card ${participant.id === selfId ? 'self' : ''}`}
								>
									<span className="seat-name">{participant.name}</span>
									{isHost && participant.id !== selfId
										? roleMenu(participant.id, 'player', copy.makePlayer)
										: null}
								</article>
							))}
						</div>
					</div>
					{revealCountdownSeconds !== null ? (
						<div
							className="countdown-overlay"
							role="status"
							aria-live="polite"
							data-testid="reveal-countdown"
						>
							<div>
								<span>{revealCountdownSeconds}</span>
							</div>
						</div>
					) : null}
				</main>

				<aside className="side-panel">
					<RoomPanel
						title={copy.voteCards}
						badge={
							<span className="badge muted-badge">
								{self?.role === 'observer'
									? copy.voteDisabled
									: voteLabel(self?.vote ?? null, language)}
							</span>
						}
					>
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
									selectedSpecialVote === null && selectedNumericVote === value;
								return (
									<button
										key={value}
										type="button"
										className={`vote-card ${active ? 'active' : ''}`}
										disabled={!canSelectVoteCards}
										onClick={() => {
											setSelectedNumericVote(value);
											setSelectedSpecialVote(null);
										}}
									>
										<span>{value}</span>
									</button>
								);
							})}
						</div>
						<div className="special-card-row">
							{SPECIAL_CARD_VALUES.map((value) => {
								const active = selectedSpecialVote === value;
								return (
									<button
										key={value}
										type="button"
										className={`vote-card special-card ${active ? 'active' : ''}`}
										disabled={!canSelectVoteCards}
										onClick={() => {
											setSelectedSpecialVote(value);
											setSelectedNumericVote(null);
										}}
									>
										{value}
									</button>
								);
							})}
						</div>
						<button
							className="vote-card clear-card"
							type="button"
							disabled={!canSubmitVote}
							onClick={handleClearVote}
						>
							{copy.clearVote}
						</button>
					</RoomPanel>
				</aside>
			</section>
			{error ? <p className="error-text center-text">{error}</p> : null}
		</div>
	);
}

function voteKey(vote: VoteChoice): string {
	return vote.kind === 'special'
		? `special:${vote.value}`
		: `estimate:${vote.base}:${vote.modifier}`;
}
