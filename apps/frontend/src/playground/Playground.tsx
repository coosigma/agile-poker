/**
 * Poker room WebSocket playground.
 *
 * Picks a {@link RoomScenario}, seeds a fresh {@link MockRoomServer}, installs
 * the mock socket over the global `WebSocket`, then renders the
 * real `RoomScreen`. The screen's `useRoomSocket` connects live to the mock
 * server, so the preview is fully interactive (you can vote, start rounds and
 * reveal exactly as against the real worker) while staying offline.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getInitialLanguage, type Language } from '../lib/i18n';
import { clearRoomIntent, setRoomIntent, voteLabel } from '../lib/poker';
import { installMockRoomSocket } from '../mocks/mock-room-socket';
import type { MockRoomServer, SimulatedPlayer } from '../mocks/room-server';
import { RoomScreen } from '../screens/RoomScreen';
import {
	NUMERIC_CARD_VALUES,
	SPECIAL_CARD_VALUES,
	type VoteChoice,
} from '../types';
import {
	PLAYGROUND_ROOM_ID,
	YOU_NAME,
	buildScenarioServer,
	crowdScenario,
	roomScenarios,
} from './scenarios';

/** Optional `?seats=N` crowd override for stress-testing the seating layout. */
function crowdOverride(): number | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const raw = new URLSearchParams(window.location.search).get('seats');
	if (raw === null) {
		return null;
	}
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function Playground() {
	const [language, setLanguage] = useState<Language>(getInitialLanguage);

	const scenarios = useMemo(() => {
		const seats = crowdOverride();
		return seats === null
			? roomScenarios
			: [crowdScenario(seats), ...roomScenarios];
	}, []);

	const [scenarioId, setScenarioId] = useState(scenarios[0].id);

	const scenario =
		scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];

	// Keep a handle on the live mock server so the simulate controls can add or
	// remove participants at runtime, plus the current simulated roster for the UI.
	const serverRef = useRef<MockRoomServer | null>(null);
	const [simPlayers, setSimPlayers] = useState<SimulatedPlayer[]>([]);

	// A parent layout effect runs before the child `RoomScreen`'s passive
	// `useEffect` (where `useRoomSocket` connects), so the mock socket and room
	// intent are installed before the first connection. Keying the screen on the
	// scenario id forces a clean remount — and re-runs this effect — per scenario.
	useLayoutEffect(() => {
		const server = buildScenarioServer(scenario);
		serverRef.current = server;
		setSimPlayers([]);
		installMockRoomSocket(server);
		if (scenario.selfIsHost) {
			setRoomIntent(PLAYGROUND_ROOM_ID, 'create');
		} else {
			clearRoomIntent();
		}
	}, [scenario]);

	function addPlayer(): void {
		const server = serverRef.current;
		if (!server) {
			return;
		}
		server.addSimulatedPlayer();
		setSimPlayers(server.simulatedPlayers());
	}

	function addPlayers(count: number): void {
		const server = serverRef.current;
		if (!server) {
			return;
		}
		for (let i = 0; i < count; i += 1) {
			server.addSimulatedPlayer();
		}
		setSimPlayers(server.simulatedPlayers());
	}

	function removePlayer(id: string): void {
		const server = serverRef.current;
		if (!server) {
			return;
		}
		server.removeSimulatedPlayer(id);
		setSimPlayers(server.simulatedPlayers());
	}

	function clearPlayers(): void {
		const server = serverRef.current;
		if (!server) {
			return;
		}
		server.clearSimulatedPlayers();
		setSimPlayers([]);
	}

	function voteAsPlayer(id: string, vote: VoteChoice): void {
		const server = serverRef.current;
		if (!server) {
			return;
		}
		server.voteAsSimulatedPlayer(id, vote);
		setSimPlayers(server.simulatedPlayers());
	}

	function clearPlayerVote(id: string): void {
		const server = serverRef.current;
		if (!server) {
			return;
		}
		server.clearSimulatedPlayerVote(id);
		setSimPlayers(server.simulatedPlayers());
	}

	return (
		<div className="playground-shell">
			<aside className="playground-sidebar">
				<h1 className="playground-title">Room playground</h1>
				<p className="playground-hint">
					Preview <code>RoomScreen</code> across seeded room states. Backed by
					the real domain reducer over a mock WebSocket — fully interactive.
				</p>
				<ul className="playground-scenarios">
					{scenarios.map((item) => (
						<li key={item.id}>
							<button
								type="button"
								className={
									item.id === scenarioId
										? 'playground-scenario is-active'
										: 'playground-scenario'
								}
								onClick={() => setScenarioId(item.id)}
							>
								<span className="playground-scenario-label">{item.label}</span>
								<span className="playground-scenario-desc">
									{item.description}
								</span>
							</button>
						</li>
					))}
				</ul>
				<section className="playground-simulate" data-testid="simulate-panel">
					<h2 className="playground-simulate-title">Simulate players</h2>
					<p className="playground-hint">
						Add or remove participants live and watch the round-table seating
						redistribute. Use each player’s cards to drive votes manually.
					</p>
					<div className="playground-simulate-actions">
						<button
							type="button"
							className="playground-sim-button"
							onClick={addPlayer}
							data-testid="sim-add"
						>
							Add player
						</button>
						<button
							type="button"
							className="playground-sim-button"
							onClick={() => addPlayers(5)}
							data-testid="sim-add-5"
						>
							+5
						</button>
						<button
							type="button"
							className="playground-sim-button is-ghost"
							onClick={clearPlayers}
							disabled={simPlayers.length === 0}
							data-testid="sim-clear"
						>
							Clear
						</button>
					</div>
					<p className="playground-simulate-count" data-testid="sim-count">
						{simPlayers.length} simulated
						{simPlayers.length === 1 ? ' player' : ' players'}
					</p>
					{simPlayers.length > 0 && (
						<ul className="playground-sim-list">
							{simPlayers.map((player) => (
								<li key={player.id} className="playground-sim-item">
									<div className="playground-sim-player">
										<div className="playground-sim-row">
											<span className="playground-sim-name">{player.name}</span>
											<span
												className="playground-sim-vote"
												data-testid={`sim-vote-${player.id}`}
											>
												{voteLabel(player.vote, language)}
											</span>
										</div>
										<div
											className="playground-sim-vote-actions"
											role="group"
											aria-label={`Vote as ${player.name}`}
										>
											{NUMERIC_CARD_VALUES.map((base) => (
												<button
													key={base}
													type="button"
													className="playground-sim-vote-button"
													onClick={() =>
														voteAsPlayer(player.id, {
															kind: 'estimate',
															base,
															modifier: 'base',
														})
													}
												>
													{base}
												</button>
											))}
											{SPECIAL_CARD_VALUES.map((value) => (
												<button
													key={value}
													type="button"
													className="playground-sim-vote-button"
													onClick={() =>
														voteAsPlayer(player.id, {
															kind: 'special',
															value,
														})
													}
												>
													{value}
												</button>
											))}
											<button
												type="button"
												className="playground-sim-vote-button is-clear"
												onClick={() => clearPlayerVote(player.id)}
											>
												Clear
											</button>
										</div>
									</div>
									<button
										type="button"
										className="playground-sim-remove"
										onClick={() => removePlayer(player.id)}
										aria-label={`Remove ${player.name}`}
									>
										×
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			</aside>
			<section className="playground-stage">
				<RoomScreen
					key={scenario.id}
					language={language}
					setLanguage={setLanguage}
					roomId={PLAYGROUND_ROOM_ID}
					name={YOU_NAME}
				/>
			</section>
		</div>
	);
}
