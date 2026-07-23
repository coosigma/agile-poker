import {
	type CSSProperties,
	type FormEvent,
	type MouseEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { InfoTip } from '../components/InfoTip';
import { LanguageSelector } from '../components/LanguageSelector';
import { RoomPanel } from '../components/RoomPanel';
import { useFitScale } from '../hooks/useFitScale';
import { usePanelAccordion } from '../hooks/usePanelAccordion';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { STRINGS, type Language } from '../lib/i18n';
import { computeScoreboardStats } from '../lib/scoreboard';
import {
	layoutSeats,
	roomShareUrl,
	voteNumericValue,
	voteLabel,
	getVotingStateLabel,
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
	readonly onBackHome: () => void;
}

export function RoomScreen({
	language,
	setLanguage,
	roomId,
	name,
	onBackHome,
}: RoomScreenProps) {
	const copy = STRINGS[language];
	const { state, selfId, connectionNotice, error, sendMessage } = useRoomSocket(
		{ enabled: true, roomId, name, language },
	);

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
		const closeRoleMenus = (event: PointerEvent) => {
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest('.seat-role-menu, .self-role-menu') !== null
			) {
				return;
			}
			document
				.querySelectorAll<HTMLDetailsElement>(
					'.seat-role-menu[open], .self-role-menu[open]',
				)
				.forEach((menu) => menu.removeAttribute('open'));
		};

		document.addEventListener('pointerdown', closeRoleMenus);
		return () => {
			document.removeEventListener('pointerdown', closeRoleMenus);
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
	const selfRoleLabel =
		self?.role === 'observer' ? copy.observerRole : copy.playerRole;
	const roleSummaryLabel = [isHost ? copy.host : null, selfRoleLabel]
		.filter(Boolean)
		.join(' · ');
	const { text: selfVoteText, modifierSymbol: selfVoteModifierSymbol } =
		splitVoteDisplay(self?.vote);
	// Left side-panel only: when its fully-expanded content would overflow the
	// available height, panels become a collapsible accordion. "Voting
	// controls" (host's primary Start/Reveal/Done actions) has the highest
	// priority to stay open, then "Room info"; "Tickets history" is never
	// auto-opened and always starts closed. As the viewport gets shorter,
	// lower-priority panels automatically collapse on their own (no fixed
	// breakpoint — purely measured against the container's real height).
	// Users may still freely open/close any combination afterwards — if the
	// open set still doesn't fit, CSS shares/shrinks the remaining space and
	// scrolls the side panel as a whole rather than overflowing the page. The
	// right (vote cards) panel is untouched.
	const leftSideRef = useRef<HTMLElement | null>(null);
	const roomInfoHeaderRef = useRef<HTMLDivElement | null>(null);
	const roomInfoBodyRef = useRef<HTMLDivElement | null>(null);
	const controlHeaderRef = useRef<HTMLDivElement | null>(null);
	const controlBodyRef = useRef<HTMLDivElement | null>(null);
	const historyHeaderRef = useRef<HTMLDivElement | null>(null);
	const historyBodyRef = useRef<HTMLDivElement | null>(null);
	const leftPanelRefs = useMemo(
		() => ({
			roomInfo: { header: roomInfoHeaderRef, body: roomInfoBodyRef },
			control: { header: controlHeaderRef, body: controlBodyRef },
			history: { header: historyHeaderRef, body: historyBodyRef },
		}),
		[],
	);
	const leftPanelIds = useMemo(
		() =>
			isHost ? ['roomInfo', 'control', 'history'] : ['roomInfo', 'history'],
		[isHost],
	);
	const leftOpenPriority = useMemo(
		() => (isHost ? ['control', 'roomInfo'] : ['roomInfo']),
		[isHost],
	);
	// When a manually opened panel would overflow, other open panels are
	// auto-closed in this order (most dispensable first) to keep it visible
	// without a scrollbar: history, then room info, then voting controls.
	const leftClosePriority = useMemo(
		() =>
			isHost ? ['history', 'roomInfo', 'control'] : ['history', 'roomInfo'],
		[isHost],
	);
	const { isAccordion, isPanelOpen, togglePanel } = usePanelAccordion(
		leftSideRef,
		leftPanelRefs,
		leftPanelIds,
		leftOpenPriority,
		leftClosePriority,
	);
	// Right side-panel (vote cards): rather than showing a scrollbar when its
	// natural content is taller than the available space, it's uniformly
	// scaled down to fit — measured live against real heights, not a fixed
	// breakpoint.
	const rightSideRef = useRef<HTMLElement | null>(null);
	const voteCardsContentRef = useRef<HTMLDivElement | null>(null);
	const voteCardsScale = useFitScale(rightSideRef, voteCardsContentRef);
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
	const votingStage = state?.votingState ?? 'noTopic';
	const stageLabel = getVotingStateLabel(language, votingStage);
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
	const hasHistorySelfVote = Boolean(currentHistorySelfVote?.vote);
	const {
		text: historySelfVoteText,
		modifierSymbol: historySelfVoteModifierSymbol,
	} = splitVoteDisplay(currentHistorySelfVote?.vote);

	const ticketHistorySlides = (
		<div className="ticket-history">
			{currentHistory ? (
				<article className="completed-round-card ticket-history-slide">
					<div className="completed-round-title">
						<strong>{currentHistory.ticketTitle}</strong>
						{shouldShowCurrentHistorySelfVote ? (
							<span className="ticket-history-self-vote">
								<span>{copy.yourVote}:</span>
								{hasHistorySelfVote ? (
									<strong className="ticket-history-self-vote-value">
										<span>{historySelfVoteText}</span>
										{historySelfVoteModifierSymbol ? (
											<span className="ticket-history-self-vote-mod">
												{historySelfVoteModifierSymbol}
											</span>
										) : null}
									</strong>
								) : (
									<strong>{copy.voteNotCast}</strong>
								)}
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

	const displayRoomName = state?.roomName || roomId;

	return (
		<div className="app-shell room-shell">
			<section className="topbar">
				<div className="room-heading">
					<button
						type="button"
						className="room-heading-icon-chip"
						title={copy.backHome}
						aria-label={`${copy.backHome}: ${displayRoomName}`}
						onClick={onBackHome}
					>
						<svg
							className="room-heading-icon"
							viewBox="0 0 16 16"
							aria-hidden="true"
							focusable="false"
						>
							<rect x="3" y="1.5" width="10" height="13" rx="1.4" />
							<circle cx="10.4" cy="8" r="0.9" />
						</svg>
					</button>
					<div className="room-heading-text">
						<h2 className="room-title">{displayRoomName}</h2>
					</div>
				</div>
				<div className="topbar-actions">
					<button
						className="secondary-button"
						onClick={async () => {
							await navigator.clipboard.writeText(roomShareUrl(roomId));
						}}
					>
						{copy.copyInvite}
					</button>
					<LanguageSelector
						language={language}
						setLanguage={setLanguage}
						compact
					/>
				</div>
			</section>
			{connectionNotice ? (
				<p className="error-text center-text">{connectionNotice}</p>
			) : null}

			<section className="room-layout">
				<aside
					className={`side-panel ${isAccordion ? 'side-panel-accordion' : ''}`}
					ref={leftSideRef}
				>
					<RoomPanel
						title={copy.roleSettings}
						className="room-info-panel"
						collapsible={isAccordion}
						open={isPanelOpen('roomInfo')}
						onToggleOpen={() => togglePanel('roomInfo')}
						collapseLabel={copy.collapsePanel}
						expandLabel={copy.expandPanel}
						headerRef={roomInfoHeaderRef}
						bodyRef={roomInfoBodyRef}
						badge={
							<span
								className="role-icon-badges"
								role="group"
								aria-label={roleSummaryLabel}
							>
								{isHost ? (
									<span
										className="role-icon-badge role-icon-badge-host"
										aria-hidden="true"
										title={copy.host}
									>
										<svg
											className="role-icon role-icon-host"
											viewBox="0 0 16 16"
											focusable="false"
										>
											<path d="M1.8 7 8 2.2 14.2 7" />
											<path d="M2.8 6.4V14h10.4V6.4" />
											<circle
												className="role-icon-fill"
												cx="8"
												cy="9.4"
												r="1.4"
											/>
											<path
												className="role-icon-fill"
												d="M5.8 14v-0.7c0-1.3 1-2 2.2-2s2.2.7 2.2 2V14"
											/>
										</svg>
									</span>
								) : null}
								<span
									className={`role-icon-badge ${
										self?.role === 'observer'
											? 'role-icon-badge-observer'
											: 'role-icon-badge-player'
									}`}
									aria-hidden="true"
									title={selfRoleLabel}
								>
									{self?.role === 'observer' ? (
										<svg
											className="role-icon role-icon-observer"
											viewBox="0 0 16 16"
											focusable="false"
										>
											<circle cx="4.7" cy="9" r="2.4" />
											<circle cx="11.3" cy="9" r="2.4" />
											<path d="M7.1 8.6h1.8M4.9 6.6 6 3.8h4l1.1 2.8" />
										</svg>
									) : (
										<svg
											className="role-icon role-icon-player"
											viewBox="0 0 16 16"
											focusable="false"
										>
											<circle cx="8" cy="5.2" r="2.3" />
											<path d="M3.2 13c0-2.8 2.1-4.4 4.8-4.4s4.8 1.6 4.8 4.4" />
										</svg>
									)}
								</span>
							</span>
						}
					>
						<div className="meta-list">
							<div>
								<strong>{selfRoleLabel}</strong>
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
							<div>
								<div className="role-vote-status">
									<strong>
										{self?.hasVoted ? copy.votedYes : copy.voteNotCast}
									</strong>
									{self?.hasVoted ? (
										<span className="badge role-vote-badge">
											<span className="role-vote-badge-value">
												{selfVoteText}
											</span>
											{selfVoteModifierSymbol ? (
												<span className="role-vote-badge-mod">
													{selfVoteModifierSymbol}
												</span>
											) : null}
										</span>
									) : null}
								</div>
								<span>{copy.myVoteStatus}</span>
							</div>
						</div>
					</RoomPanel>

					{isHost ? (
						<RoomPanel
							title={copy.hostControls}
							collapsible={isAccordion}
							open={isPanelOpen('control')}
							onToggleOpen={() => togglePanel('control')}
							collapseLabel={copy.collapsePanel}
							expandLabel={copy.expandPanel}
							headerRef={controlHeaderRef}
							bodyRef={controlBodyRef}
							badge={
								<span
									className={`badge stage-badge stage-badge-${votingStage}`}
								>
									{stageLabel}
								</span>
							}
						>
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
						</RoomPanel>
					) : null}

					<RoomPanel
						title={copy.completedTickets}
						actions={ticketHistoryActions}
						className="completed-rounds-panel"
						collapsible={isAccordion}
						open={isPanelOpen('history')}
						onToggleOpen={() => togglePanel('history')}
						collapseLabel={copy.collapsePanel}
						expandLabel={copy.expandPanel}
						headerRef={historyHeaderRef}
						bodyRef={historyBodyRef}
					>
						{ticketHistorySlides}
					</RoomPanel>
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

				<aside className="side-panel side-panel-fit" ref={rightSideRef}>
					<div
						className="side-panel-fit-content"
						ref={voteCardsContentRef}
						style={
							{
								transform: `scale(${voteCardsScale})`,
								width: `calc(100% / ${voteCardsScale})`,
							} as CSSProperties
						}
					>
						<RoomPanel
							title={copy.voteCards}
							badge={
								self?.role === 'observer' ? (
									<span className="badge muted-badge">{copy.voteDisabled}</span>
								) : self?.hasVoted ? (
									<span className="badge muted-badge vote-cards-badge">
										<span className="vote-cards-badge-value">
											{selfVoteText}
										</span>
										{selfVoteModifierSymbol ? (
											<span className="vote-cards-badge-mod">
												{selfVoteModifierSymbol}
											</span>
										) : null}
									</span>
								) : (
									<span className="badge muted-badge">{copy.voteNotCast}</span>
								)
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
										selectedSpecialVote === null &&
										selectedNumericVote === value;
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
					</div>
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

function splitVoteDisplay(vote: VoteChoice | null | undefined): {
	text: string;
	modifierSymbol: string | null;
} {
	const text = vote?.kind === 'special' ? vote.value : (vote?.base ?? '');
	const modifierSymbol =
		vote?.kind === 'estimate' && vote.modifier !== 'base'
			? vote.modifier === 'sharp'
				? '♯'
				: '♭'
			: null;
	return { text, modifierSymbol };
}
