import type { FormEvent, KeyboardEvent } from 'react';
import { LanguageSelector } from '../components/LanguageSelector';
import { STRINGS, type Language } from '../lib/i18n';
import type { RoomIntentType } from '../lib/poker';
import type { ParticipantRole } from '../types';

interface NameEntryScreenProps {
	readonly language: Language;
	readonly setLanguage: (language: Language) => void;
	readonly roomId: string;
	readonly nameDraft: string;
	readonly setNameDraft: (value: string) => void;
	readonly roleDraft: ParticipantRole;
	readonly setRoleDraft: (value: ParticipantRole) => void;
	readonly intentType: RoomIntentType | undefined;
	readonly roomNameDraft: string;
	readonly setRoomNameDraft: (value: string) => void;
	readonly onSubmit: (event: FormEvent) => void;
	readonly onBack: () => void;
	readonly error: string;
}

export function NameEntryScreen({
	language,
	setLanguage,
	roomId,
	nameDraft,
	setNameDraft,
	roleDraft,
	setRoleDraft,
	intentType,
	roomNameDraft,
	setRoomNameDraft,
	onSubmit,
	onBack,
	error,
}: NameEntryScreenProps) {
	const copy = STRINGS[language];
	const roleOptions: readonly ParticipantRole[] = ['player', 'observer'];
	const focusRoleChoice = (
		event: KeyboardEvent<HTMLButtonElement>,
		role: ParticipantRole,
	) => {
		setRoleDraft(role);
		event.currentTarget.parentElement
			?.querySelector<HTMLButtonElement>(`[data-role-choice="${role}"]`)
			?.focus();
	};
	const handleRoleChoiceKeyDown = (
		event: KeyboardEvent<HTMLButtonElement>,
		role: ParticipantRole,
	) => {
		const currentIndex = roleOptions.indexOf(role);
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			focusRoleChoice(
				event,
				roleOptions[(currentIndex + 1) % roleOptions.length],
			);
		}
		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			focusRoleChoice(
				event,
				roleOptions[
					(currentIndex - 1 + roleOptions.length) % roleOptions.length
				],
			);
		}
		if (event.key === 'Home') {
			event.preventDefault();
			focusRoleChoice(event, roleOptions[0]);
		}
		if (event.key === 'End') {
			event.preventDefault();
			focusRoleChoice(event, roleOptions[roleOptions.length - 1]);
		}
	};
	return (
		<div className="app-shell landing-shell">
			<section className="compact-card">
				<div className="landing-toolbar compact-toolbar">
					<LanguageSelector language={language} setLanguage={setLanguage} />
				</div>
				<p className="eyebrow">
					{copy.roomLabel} {roomId}
				</p>
				<h2>{copy.enterNameTitle}</h2>
				<p className="lede">
					{intentType === 'create'
						? copy.enterNameLedeCreate
						: copy.enterNameLedeJoin}
				</p>
				<form className="stack" onSubmit={onSubmit}>
					{intentType === 'create' ? (
						<label>
							{copy.roomNameLabel}
							<input
								value={roomNameDraft}
								onChange={(event) => setRoomNameDraft(event.target.value)}
								placeholder={copy.roomNamePlaceholder}
							/>
						</label>
					) : null}
					<label>
						{copy.nickname}
						<input
							value={nameDraft}
							onChange={(event) => setNameDraft(event.target.value)}
							placeholder="Alice"
						/>
					</label>
					<div
						className="role-choice-group"
						role="radiogroup"
						aria-label={copy.roleLabel}
					>
						<button
							type="button"
							className={`role-choice ${roleDraft === 'player' ? 'active' : ''}`}
							role="radio"
							aria-checked={roleDraft === 'player'}
							tabIndex={roleDraft === 'player' ? 0 : -1}
							data-role-choice="player"
							onClick={() => setRoleDraft('player')}
							onKeyDown={(event) => handleRoleChoiceKeyDown(event, 'player')}
						>
							<strong>{copy.playerRole}</strong>
							<span>{copy.playerRoleDesc}</span>
						</button>
						<button
							type="button"
							className={`role-choice ${roleDraft === 'observer' ? 'active' : ''}`}
							role="radio"
							aria-checked={roleDraft === 'observer'}
							tabIndex={roleDraft === 'observer' ? 0 : -1}
							data-role-choice="observer"
							onClick={() => setRoleDraft('observer')}
							onKeyDown={(event) => handleRoleChoiceKeyDown(event, 'observer')}
						>
							<strong>{copy.observerRole}</strong>
							<span>{copy.observerRoleDesc}</span>
						</button>
					</div>
					<button className="primary-button" type="submit">
						{copy.enterRoom}
					</button>
					<button className="ghost-button" type="button" onClick={onBack}>
						{copy.backHome}
					</button>
				</form>
				{error ? <p className="error-text">{error}</p> : null}
			</section>
		</div>
	);
}
