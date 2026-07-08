import type { FormEvent } from 'react';
import { LanguageSelector } from '../components/LanguageSelector';
import { STRINGS, type Language } from '../lib/i18n';

interface JoinRoomScreenProps {
	readonly language: Language;
	readonly setLanguage: (language: Language) => void;
	readonly joinRoomDraft: string;
	readonly setJoinRoomDraft: (value: string) => void;
	readonly onSubmit: (event: FormEvent) => void;
	readonly onBack: () => void;
	readonly error: string;
}

export function JoinRoomScreen({
	language,
	setLanguage,
	joinRoomDraft,
	setJoinRoomDraft,
	onSubmit,
	onBack,
	error,
}: JoinRoomScreenProps) {
	const copy = STRINGS[language];
	return (
		<div className="app-shell landing-shell">
			<section className="compact-card">
				<div className="landing-toolbar compact-toolbar">
					<LanguageSelector language={language} setLanguage={setLanguage} />
				</div>
				<p className="eyebrow">{copy.joinRoom}</p>
				<h2>{copy.joinTitle}</h2>
				<p className="lede">{copy.joinLede}</p>
				<form className="stack" onSubmit={onSubmit}>
					<label>
						{copy.roomId}
						<input
							value={joinRoomDraft}
							onChange={(event) =>
								setJoinRoomDraft(event.target.value.toUpperCase())
							}
							placeholder="AB12CD"
						/>
					</label>
					<button className="primary-button" type="submit">
						{copy.continue}
					</button>
					<button className="ghost-button" type="button" onClick={onBack}>
						{copy.back}
					</button>
				</form>
				{error ? <p className="error-text">{error}</p> : null}
			</section>
		</div>
	);
}
