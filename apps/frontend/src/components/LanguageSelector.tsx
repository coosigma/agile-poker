import { LANGUAGE_OPTIONS, STRINGS, type Language } from '../lib/i18n';

interface LanguageSelectorProps {
	readonly language: Language;
	readonly setLanguage: (language: Language) => void;
}

export function LanguageSelector({
	language,
	setLanguage,
}: LanguageSelectorProps) {
	const copy = STRINGS[language];
	return (
		<label className="language-picker">
			<span>{copy.languageLabel}</span>
			<select
				value={language}
				onChange={(event) => setLanguage(event.target.value as Language)}
			>
				{LANGUAGE_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			<small>{copy.languageHelp}</small>
		</label>
	);
}
