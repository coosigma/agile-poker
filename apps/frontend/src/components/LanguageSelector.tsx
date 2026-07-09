import { useEffect, useRef, useState } from 'react';
import { LANGUAGE_OPTIONS, STRINGS, type Language } from '../lib/i18n';

interface LanguageSelectorProps {
	readonly language: Language;
	readonly setLanguage: (language: Language) => void;
	readonly compact?: boolean;
}

export function LanguageSelector({
	language,
	setLanguage,
	compact = false,
}: LanguageSelectorProps) {
	const copy = STRINGS[language];

	if (compact) {
		return (
			<CompactLanguageSelector language={language} setLanguage={setLanguage} />
		);
	}

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

function CompactLanguageSelector({
	language,
	setLanguage,
}: Pick<LanguageSelectorProps, 'language' | 'setLanguage'>) {
	const copy = STRINGS[language];
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);

	return (
		<div className="language-menu" ref={rootRef}>
			<button
				type="button"
				className="language-menu-button"
				aria-label={copy.languageLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					aria-hidden="true"
					focusable="false"
				>
					<text
						x="2"
						y="11"
						fill="currentColor"
						fontSize="12"
						fontWeight="600"
						dominantBaseline="central"
					>
						文
					</text>
					<text
						x="11"
						y="19"
						fill="currentColor"
						fontSize="12"
						fontWeight="700"
						dominantBaseline="central"
					>
						A
					</text>
				</svg>
			</button>
			{open ? (
				<ul className="language-menu-list" role="listbox">
					{LANGUAGE_OPTIONS.map((option) => (
						<li key={option.value}>
							<button
								type="button"
								role="option"
								aria-selected={option.value === language}
								className={`language-menu-item ${option.value === language ? 'active' : ''}`}
								onClick={() => {
									setLanguage(option.value);
									setOpen(false);
								}}
							>
								{option.label}
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
