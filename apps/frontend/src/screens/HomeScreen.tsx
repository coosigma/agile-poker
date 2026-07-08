import { LanguageSelector } from '../components/LanguageSelector';
import { STRINGS, type Language } from '../lib/i18n';

interface HomeScreenProps {
	readonly language: Language;
	readonly setLanguage: (language: Language) => void;
	readonly error: string;
	readonly onCreateRoom: () => void;
	readonly onJoinRoom: () => void;
}

export function HomeScreen({
	language,
	setLanguage,
	error,
	onCreateRoom,
	onJoinRoom,
}: HomeScreenProps) {
	const copy = STRINGS[language];
	return (
		<div className="app-shell landing-shell">
			<section className="landing-stage">
				<div className="landing-toolbar">
					<LanguageSelector language={language} setLanguage={setLanguage} />
				</div>
				<div className="landing-copy">
					<p className="eyebrow">{copy.appTitle}</p>
					<h1>{copy.homeTitle}</h1>
					<p className="lede">{copy.homeLede}</p>
				</div>
				<div className="choice-grid">
					<button
						className="mode-card mode-card-create"
						type="button"
						onClick={onCreateRoom}
					>
						<span>{copy.createRoom}</span>
						<strong>{copy.createRoomDesc}</strong>
					</button>
					<button
						className="mode-card mode-card-join"
						type="button"
						onClick={onJoinRoom}
					>
						<span>{copy.joinRoom}</span>
						<strong>{copy.joinRoomDesc}</strong>
					</button>
				</div>
				{error ? <p className="error-text center-text">{error}</p> : null}
			</section>
		</div>
	);
}
