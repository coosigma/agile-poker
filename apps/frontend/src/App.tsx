import { type FormEvent, useEffect, useState } from 'react';
import { buildApiUrl } from './config';
import {
	getInitialLanguage,
	LANGUAGE_KEY,
	STRINGS,
	type Language,
} from './lib/i18n';
import {
	clearRoomIntent,
	getInitialName,
	getRoomIdFromUrl,
	getRoomIntent,
	persistName,
	randomRoomId,
	roomShareUrl,
	setRoomIntent,
	updateRoomInUrl,
} from './lib/poker';
import { HomeScreen } from './screens/HomeScreen';
import { JoinRoomScreen } from './screens/JoinRoomScreen';
import { NameEntryScreen } from './screens/NameEntryScreen';
import { RoomScreen } from './screens/RoomScreen';
import type { ParticipantRole } from './types';

type Screen = 'home' | 'join-room' | 'name-entry' | 'room';

export function App() {
	const initialRoomId = getRoomIdFromUrl();
	const [screen, setScreen] = useState<Screen>(
		initialRoomId && getInitialName()
			? 'room'
			: initialRoomId
				? 'name-entry'
				: 'home',
	);
	const [roomId, setRoomId] = useState(initialRoomId);
	const [name, setName] = useState(getInitialName);
	const [nameDraft, setNameDraft] = useState(getInitialName);
	const [roleDraft, setRoleDraft] = useState<ParticipantRole>('player');
	const [joinRoomDraft, setJoinRoomDraft] = useState('');
	const [roomNameDraft, setRoomNameDraft] = useState('');
	const [language, setLanguage] = useState<Language>(getInitialLanguage);
	const [error, setError] = useState('');

	const copy = STRINGS[language];

	useEffect(() => {
		persistName(name);
	}, [name]);

	useEffect(() => {
		window.localStorage.setItem(LANGUAGE_KEY, language);
	}, [language]);

	const handleCreateRoom = async () => {
		const nextRoomId = randomRoomId();
		const response = await fetch(buildApiUrl(`/rooms/${nextRoomId}`), {
			method: 'PUT',
		});
		if (!response.ok) {
			setError(copy.createRoomError);
			return;
		}
		updateRoomInUrl(nextRoomId);
		setRoomIntent(nextRoomId, 'create', 'observer');
		setRoomId(nextRoomId);
		setRoleDraft('observer');
		setError('');
		setScreen('name-entry');
	};

	const handleCheckRoom = async (event: FormEvent) => {
		event.preventDefault();
		const normalizedRoomId = joinRoomDraft.trim().toUpperCase();
		if (!normalizedRoomId) {
			setError(copy.enterRoomIdError);
			return;
		}

		const response = await fetch(buildApiUrl(`/rooms/${normalizedRoomId}`));
		if (!response.ok) {
			setError(copy.verifyRoomError);
			return;
		}
		const payload = (await response.json()) as { exists: boolean };
		if (!payload.exists) {
			setError(copy.roomMissingError);
			return;
		}

		updateRoomInUrl(normalizedRoomId);
		setRoomIntent(normalizedRoomId, 'join', roleDraft);
		setRoomId(normalizedRoomId);
		setError('');
		setScreen('name-entry');
	};

	const handleNameEntry = (event: FormEvent) => {
		event.preventDefault();
		const nextName = nameDraft.trim() || '匿名成员';
		setName(nextName);
		if (roomId) {
			const intent = getRoomIntent(roomId);
			const intentType = intent?.type ?? 'join';
			if (intentType === 'create' && !roomNameDraft.trim()) {
				setError(copy.roomNameRequiredError);
				return;
			}
			setError('');
			setRoomIntent(
				roomId,
				intentType,
				roleDraft,
				intentType === 'create' ? roomNameDraft.trim() : undefined,
			);
			updateRoomInUrl(roomId);
			window.location.replace(roomShareUrl(roomId));
			return;
		}
		setError('');
		setScreen('room');
	};

	const handleBackHome = () => {
		updateRoomInUrl('');
		clearRoomIntent();
		setRoomId('');
		setRoomNameDraft('');
		setError('');
		setScreen('home');
	};

	if (screen === 'home') {
		return (
			<HomeScreen
				language={language}
				setLanguage={setLanguage}
				error={error}
				onCreateRoom={handleCreateRoom}
				onJoinRoom={() => setScreen('join-room')}
			/>
		);
	}

	if (screen === 'join-room') {
		return (
			<JoinRoomScreen
				language={language}
				setLanguage={setLanguage}
				joinRoomDraft={joinRoomDraft}
				setJoinRoomDraft={setJoinRoomDraft}
				onSubmit={handleCheckRoom}
				onBack={handleBackHome}
				error={error}
			/>
		);
	}

	if (screen === 'name-entry') {
		return (
			<NameEntryScreen
				language={language}
				setLanguage={setLanguage}
				roomId={roomId}
				nameDraft={nameDraft}
				setNameDraft={setNameDraft}
				roleDraft={roleDraft}
				setRoleDraft={setRoleDraft}
				intentType={getRoomIntent(roomId)?.type}
				roomNameDraft={roomNameDraft}
				setRoomNameDraft={setRoomNameDraft}
				onSubmit={handleNameEntry}
				onBack={handleBackHome}
				error={error}
			/>
		);
	}

	return (
		<RoomScreen
			language={language}
			setLanguage={setLanguage}
			roomId={roomId}
			name={name}
			onBackHome={handleBackHome}
		/>
	);
}
