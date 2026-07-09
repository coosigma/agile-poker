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
					<path
						fill="currentColor"
						d="M11 3H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1.2l-.6 3.2L8.5 15H11a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-.5 8.2c-.9-.3-1.6-.7-2.3-1.2.8-1 1.3-2 1.5-3.2h.9V5.6H7.9V4.5H6.7v1.1H3.9v1.2h4.4c-.2.9-.6 1.6-1.1 2.3-.4-.5-.7-1-.9-1.5H5.1c.3.8.7 1.6 1.3 2.2-.7.5-1.4.8-2.2 1.1l.4 1.1c1-.3 1.8-.7 2.6-1.3.7.6 1.6 1 2.5 1.4l.4-1.1Z"
					/>
					<path
						fill="currentColor"
						d="M15.8 8h1.6l3 8h-1.6l-.7-2h-3l-.7 2H13l2.8-8Zm.8 1.9-1 2.7h2l-1-2.7Z"
					/>
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
