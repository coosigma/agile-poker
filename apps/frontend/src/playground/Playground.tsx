/**
 * Poker room WebSocket playground.
 *
 * Picks a {@link RoomScenario}, seeds a fresh {@link MockRoomServer}, installs
 * the mock socket over the global `WebSocket`, then renders the
 * real `RoomScreen`. The screen's `useRoomSocket` connects live to the mock
 * server, so the preview is fully interactive (you can vote, start rounds and
 * reveal exactly as against the real worker) while staying offline.
 */
import {
	type PointerEvent as ReactPointerEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
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

interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

// Minimum draggable/typed frame size — small enough to still reach the
// shortest accordion bucket, but not so small the room layout breaks down.
const MIN_FRAME_WIDTH = 480;
const MIN_FRAME_HEIGHT = 360;

// Preset simulated viewport sizes for previewing the left sidebar's
// short-screen accordion behavior without resizing the real browser window.
// Heights span both sides of the `styles.css` media-query buckets
// (800px/650px).
const VIEWPORT_PRESETS: ReadonlyArray<{
	readonly label: string;
	readonly width: number;
	readonly height: number;
}> = [
	{ label: '1280 × 900 (tall)', width: 1280, height: 900 },
	{ label: '1280 × 800', width: 1280, height: 800 },
	{ label: '1280 × 720', width: 1280, height: 720 },
	{ label: '1024 × 700', width: 1024, height: 700 },
	{ label: '1024 × 650', width: 1024, height: 650 },
	{ label: '900 × 600 (short)', width: 900, height: 600 },
	{ label: '820 × 500 (very short)', width: 820, height: 500 },
];

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

	// Simulated viewport size for the stage frame; `null` means "auto" (the
	// frame just fills the stage, tracking the real window like before).
	// Settable three ways: dragging the frame's resize handle, picking a
	// preset, or typing exact width/height numbers.
	const [viewportSize, setViewportSize] = useState<ViewportSize | null>(null);
	const [widthDraft, setWidthDraft] = useState('1280');
	const [heightDraft, setHeightDraft] = useState('720');
	const frameRef = useRef<HTMLDivElement | null>(null);
	const dragStateRef = useRef<{
		readonly startX: number;
		readonly startY: number;
		readonly startWidth: number;
		readonly startHeight: number;
	} | null>(null);

	function applySize(size: ViewportSize): void {
		setViewportSize(size);
		setWidthDraft(String(size.width));
		setHeightDraft(String(size.height));
	}

	function applyCustomSize(): void {
		const width = Number.parseInt(widthDraft, 10);
		const height = Number.parseInt(heightDraft, 10);
		if (!Number.isFinite(width) || !Number.isFinite(height)) {
			return;
		}
		applySize({
			width: Math.max(MIN_FRAME_WIDTH, width),
			height: Math.max(MIN_FRAME_HEIGHT, height),
		});
	}

	// Drag-to-resize: grabbing the handle first snapshots the frame's current
	// on-screen size (so dragging from "auto" mode starts from what's already
	// visible, not a jump), then tracks the pointer via native capture so the
	// resize keeps working even if the cursor leaves the handle mid-drag.
	function beginResize(event: ReactPointerEvent<HTMLDivElement>): void {
		const frame = frameRef.current;
		if (!frame) {
			return;
		}
		const rect = frame.getBoundingClientRect();
		dragStateRef.current = {
			startX: event.clientX,
			startY: event.clientY,
			startWidth: rect.width,
			startHeight: rect.height,
		};
		applySize({
			width: Math.round(rect.width),
			height: Math.round(rect.height),
		});
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function onResizeMove(event: ReactPointerEvent<HTMLDivElement>): void {
		const drag = dragStateRef.current;
		if (!drag) {
			return;
		}
		const width = Math.max(
			MIN_FRAME_WIDTH,
			Math.round(drag.startWidth + (event.clientX - drag.startX)),
		);
		const height = Math.max(
			MIN_FRAME_HEIGHT,
			Math.round(drag.startHeight + (event.clientY - drag.startY)),
		);
		applySize({ width, height });
	}

	function endResize(event: ReactPointerEvent<HTMLDivElement>): void {
		dragStateRef.current = null;
		event.currentTarget.releasePointerCapture(event.pointerId);
	}

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
		const unsubscribe = server.subscribe(() => {
			setSimPlayers(server.simulatedPlayers());
		});
		installMockRoomSocket(server);
		if (scenario.selfIsHost) {
			setRoomIntent(PLAYGROUND_ROOM_ID, 'create');
		} else {
			clearRoomIntent();
		}
		return unsubscribe;
	}, [scenario]);

	function addPlayer(): void {
		const server = serverRef.current;
		if (!server) {
			return;
		}
		server.addSimulatedPlayer();
		setSimPlayers(server.simulatedPlayers());
	}

	function addObserver(): void {
		const server = serverRef.current;
		if (!server) {
			return;
		}
		server.addSimulatedObserver();
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
				<section className="playground-viewport" data-testid="viewport-panel">
					<h2 className="playground-viewport-title">Viewport size</h2>
					<p className="playground-hint">
						Drag the ⤡ handle at the bottom-right corner of the preview, pick a
						preset, or type an exact width × height to test the sidebar’s
						short-screen accordion behavior.
					</p>
					<div className="playground-viewport-presets">
						{VIEWPORT_PRESETS.map((preset) => (
							<button
								key={preset.label}
								type="button"
								className="playground-viewport-preset"
								onClick={() => applySize(preset)}
								data-testid={`viewport-preset-${preset.width}x${preset.height}`}
							>
								{preset.label}
							</button>
						))}
					</div>
					<div className="playground-viewport-custom">
						<label className="playground-viewport-field">
							<span>W</span>
							<input
								type="number"
								min={MIN_FRAME_WIDTH}
								value={widthDraft}
								onChange={(event) => setWidthDraft(event.target.value)}
								data-testid="viewport-width-input"
							/>
						</label>
						<span className="playground-viewport-x" aria-hidden="true">
							×
						</span>
						<label className="playground-viewport-field">
							<span>H</span>
							<input
								type="number"
								min={MIN_FRAME_HEIGHT}
								value={heightDraft}
								onChange={(event) => setHeightDraft(event.target.value)}
								data-testid="viewport-height-input"
							/>
						</label>
						<button
							type="button"
							className="playground-viewport-apply"
							onClick={applyCustomSize}
							data-testid="viewport-apply"
						>
							Apply
						</button>
					</div>
					<button
						type="button"
						className="playground-viewport-reset"
						onClick={() => setViewportSize(null)}
						disabled={viewportSize === null}
						data-testid="viewport-reset"
					>
						Reset to real window
					</button>
				</section>
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
							onClick={addObserver}
							data-testid="sim-add-observer"
						>
							Add observer
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
						{simPlayers.length === 1 ? ' participant' : ' participants'}
					</p>
					{simPlayers.length > 0 && (
						<ul className="playground-sim-list">
							{simPlayers.map((player) => (
								<li key={player.id} className="playground-sim-item">
									<div className="playground-sim-player">
										<div className="playground-sim-row">
											<span className="playground-sim-name">{player.name}</span>
											<span
												className={`playground-sim-vote ${player.role === 'observer' ? 'is-observer' : ''}`}
												data-testid={`sim-vote-${player.id}`}
											>
												{player.role === 'observer'
													? 'Observer'
													: voteLabel(player.vote, language)}
											</span>
										</div>
										{player.role === 'player' ? (
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
										) : null}
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
				<div
					ref={frameRef}
					className={
						viewportSize === null
							? 'playground-viewport-frame'
							: 'playground-viewport-frame is-fixed'
					}
					style={
						viewportSize === null
							? undefined
							: {
									width: `${viewportSize.width}px`,
									height: `${viewportSize.height}px`,
								}
					}
					data-testid="viewport-frame"
				>
					<RoomScreen
						key={scenario.id}
						language={language}
						setLanguage={setLanguage}
						roomId={PLAYGROUND_ROOM_ID}
						name={YOU_NAME}
						onBackHome={() => {}}
					/>
					<div
						className="playground-viewport-resize-handle"
						onPointerDown={beginResize}
						onPointerMove={onResizeMove}
						onPointerUp={endResize}
						data-testid="viewport-resize-handle"
						aria-hidden="true"
					/>
				</div>
			</section>
		</div>
	);
}
