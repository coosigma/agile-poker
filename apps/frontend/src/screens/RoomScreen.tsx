import {
	type CSSProperties,
	type FormEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { LanguageSelector } from '../components/LanguageSelector';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { STRINGS, formatText, type Language } from '../lib/i18n';
import {
	getPhaseLabel,
	layoutSeats,
	roomShareUrl,
	voteLabel,
	voteNumericValue,
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
	const connectedCount = participants.filter(
		(participant) => participant.connected,
	).length;
	const votedCount = participants.filter(
		(participant) => participant.vote,
	).length;

	const stats = useMemo(() => {
		if (state?.phase !== 'revealed') {
			return null;
		}

		const buckets = new Map<string, number>();
		const numericVotes: number[] = [];
		const totalVotes = participants.filter(
			(participant) => participant.vote,
		).length;

		for (const participant of participants) {
			const label = voteLabel(participant.vote, language);
			if (participant.vote) {
				buckets.set(label, (buckets.get(label) ?? 0) + 1);
			}
			const numericValue = voteNumericValue(participant.vote);
			if (numericValue !== null) {
				numericVotes.push(numericValue);
			}
		}

		return {
			average:
				numericVotes.length > 0
					? (
							numericVotes.reduce((sum, value) => sum + value, 0) /
							numericVotes.length
						).toFixed(2)
					: 'N/A',
			totalVotes,
			breakdown: [...buckets.entries()]
				.map(([label, count]) => ({
					label,
					count,
					ratio: totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(0) : '0',
				}))
				.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
		};
	}, [language, participants, state?.phase]);

	const handleTicketSubmit = (event: FormEvent) => {
		event.preventDefault();
		sendMessage({ type: 'set_ticket', ticketTitle: ticketDraft.trim() });
	};

	const seatLayouts = layoutSeats(participants.length, frameAspect);
	const seats = participants.map((participant, index) => ({
		participant,
		...seatLayouts[index],
	}));

	return (
		<div className="app-shell room-shell">
			<section className="topbar">
				<div>
					<p className="eyebrow">
						{copy.roomLabel} {roomId}
					</p>
					<h2 className="room-title">
						{state?.ticketTitle || copy.waitingTopic}
					</h2>
				</div>
				<div className="topbar-actions">
					<LanguageSelector language={language} setLanguage={setLanguage} />
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
								<span>{copy.currentPhase}</span>
								<strong>
									{getPhaseLabel(
										language,
										state?.phase ?? 'lobby',
										state?.countdownValue ?? null,
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

					<div className="panel">
						<div className="panel-header">
							<h3>{copy.hostControls}</h3>
							<span className="badge muted-badge">
								{isHost ? copy.ready : copy.readOnly}
							</span>
						</div>
						<form className="stack" onSubmit={handleTicketSubmit}>
							<label>
								{copy.currentTicket}
								<input
									disabled={!isHost}
									value={ticketDraft}
									onChange={(event) => setTicketDraft(event.target.value)}
									placeholder={copy.ticketPlaceholder}
								/>
							</label>
							<button
								className="secondary-button"
								type="submit"
								disabled={!isHost}
							>
								{copy.updateTicket}
							</button>
						</form>
						<div className="stack">
							<button
								className="primary-button"
								type="button"
								disabled={!isHost}
								onClick={() => sendMessage({ type: 'start_round' })}
							>
								{copy.startRound}
							</button>
							<button
								className="secondary-button"
								type="button"
								disabled={!isHost || votedCount === 0}
								onClick={() => sendMessage({ type: 'reveal_votes' })}
							>
								{copy.reveal}
							</button>
						</div>
					</div>
				</aside>

				<main className="table-zone">
					<div className="table-frame" ref={tableFrameRef}>
						{state?.phase === 'countdown' ? (
							<div className="countdown-overlay">
								<span>{state.countdownValue}</span>
								<small>
									{formatText(copy.stageCountdown, {
										countdown: state.countdownValue ?? '-',
									})}
								</small>
							</div>
						) : null}
						<div className="ellipse-table">
							<div className="table-center">
								<p>{copy.revealTable}</p>
								<strong>{state?.ticketTitle || copy.waitingTopic}</strong>
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
									{state?.phase === 'revealed'
										? voteLabel(participant.vote, language)
										: participant.vote
											? copy.votedYes
											: copy.voteNotCast}
								</strong>
								<small>
									{participant.connected ? copy.online : copy.offline}
								</small>
							</article>
						))}
					</div>

					<div className="panel table-results-panel">
						<div className="panel-header">
							<h3>{copy.tableStats}</h3>
							<span className="badge">
								{state?.phase === 'revealed'
									? copy.statsReady
									: copy.statsWaiting}
							</span>
						</div>
						{stats ? (
							<div className="results-grid">
								<div className="stats-highlight">
									<span>{copy.overallAverage}</span>
									<strong>{stats.average}</strong>
								</div>
								<div className="stats-highlight">
									<span>{copy.validVotes}</span>
									<strong>{stats.totalVotes}</strong>
								</div>
								<div className="breakdown-strip">
									{stats.breakdown.map((item) => (
										<div key={item.label} className="breakdown-item">
											<span>{item.label}</span>
											<strong>
												{item.count} {copy.voteUnit}
											</strong>
											<small>{item.ratio}%</small>
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="empty-state">{copy.afterRevealStats}</div>
						)}
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
										disabled={
											state?.phase !== 'voting' && state?.phase !== 'revealed'
										}
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
										<small>
											{modifier === 'flat'
												? '♭'
												: modifier === 'sharp'
													? '♯'
													: '·'}
										</small>
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
										disabled={
											state?.phase !== 'voting' && state?.phase !== 'revealed'
										}
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
						<div className="modifier-section">
							<div className="modifier-copy">
								<strong>{copy.optionalModifier}</strong>
								<p>{copy.optionalModifierHelp}</p>
							</div>
							<div className="modifier-row">
								{MODIFIER_OPTIONS.map((option) => (
									<button
										key={option}
										type="button"
										className={`modifier-button ${modifier === option ? 'active' : ''}`}
										onClick={() => setModifier(option)}
									>
										{option === 'flat'
											? copy.modifierFlat
											: option === 'sharp'
												? copy.modifierSharp
												: copy.modifierBase}
									</button>
								))}
							</div>
						</div>
						<button
							className="vote-card clear-card"
							type="button"
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
