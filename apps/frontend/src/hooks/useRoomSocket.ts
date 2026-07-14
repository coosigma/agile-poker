import { useCallback, useEffect, useRef, useState } from 'react';
import { buildRoomWebSocketUrl } from '../config';
import { STRINGS, type Language } from '../lib/i18n';
import { clearRoomIntent, getRoomIntent } from '../lib/poker';
import type { RoomState, ServerMessage } from '../types';

export type SocketStatus = 'connecting' | 'open' | 'closed';

interface UseRoomSocketOptions {
	readonly enabled: boolean;
	readonly roomId: string;
	readonly name: string;
	readonly language: Language;
}

interface UseRoomSocketResult {
	readonly state: RoomState | null;
	readonly selfId: string;
	readonly socketStatus: SocketStatus;
	readonly connectionNotice: string;
	readonly error: string;
	readonly setError: (message: string) => void;
	readonly sendMessage: (payload: object) => void;
}

export function useRoomSocket({
	enabled,
	roomId,
	name,
	language,
}: UseRoomSocketOptions): UseRoomSocketResult {
	const [state, setState] = useState<RoomState | null>(null);
	const [selfId, setSelfId] = useState('');
	const [socketStatus, setSocketStatus] = useState<SocketStatus>('closed');
	const [connectionNotice, setConnectionNotice] = useState('');
	const [error, setError] = useState('');
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		if (!enabled || !roomId || !name) {
			return;
		}

		const copy = STRINGS[language];
		setSocketStatus('connecting');
		setConnectionNotice('');

		const socketUrl = buildRoomWebSocketUrl(roomId);

		let socket: WebSocket;
		try {
			socket = new WebSocket(socketUrl);
		} catch {
			console.warn('WebSocket connection could not be created.');
			setSocketStatus('closed');
			setConnectionNotice(copy.connectionWarning);
			return;
		}

		socketRef.current = socket;

		socket.addEventListener('open', () => {
			setSocketStatus('open');
			setConnectionNotice('');
			const intent = getRoomIntent(roomId);
			socket.send(
				JSON.stringify({
					type: 'join_room',
					roomId,
					name,
					claimHost: intent?.type === 'create',
					role:
						intent?.role ?? (intent?.type === 'create' ? 'observer' : 'player'),
				}),
			);
		});

		socket.addEventListener('message', (event) => {
			const message = JSON.parse(event.data) as ServerMessage;
			if (message.type === 'error') {
				setError(message.message);
				return;
			}
			setState(message.state);
			setSelfId(message.selfId);
			setError('');
			clearRoomIntent();
		});

		socket.addEventListener('error', () => {
			console.warn('WebSocket connection failed or was interrupted.');
			setSocketStatus('closed');
			setConnectionNotice(copy.connectionWarning);
		});

		socket.addEventListener('close', () => {
			setSocketStatus('closed');
			if (socketRef.current === socket) {
				socketRef.current = null;
			}
		});

		return () => {
			socket.close();
		};
	}, [enabled, name, roomId, language]);

	const sendMessage = useCallback(
		(payload: object) => {
			const socket = socketRef.current;
			if (!socket || socket.readyState !== WebSocket.OPEN) {
				setError(STRINGS[language].socketNotReadyError);
				return;
			}
			socket.send(JSON.stringify(payload));
		},
		[language],
	);

	return {
		state,
		selfId,
		socketStatus,
		connectionNotice,
		error,
		setError,
		sendMessage,
	};
}
