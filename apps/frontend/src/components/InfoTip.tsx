import { useEffect, useId, useRef, useState } from 'react';

interface InfoTipProps {
	readonly label: string;
	readonly text: string;
}

export function InfoTip({ label, text }: InfoTipProps) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLSpanElement | null>(null);
	const bubbleId = useId();

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
		<span className={`info-tip ${open ? 'open' : ''}`} ref={rootRef}>
			<button
				type="button"
				className="info-tip-button"
				aria-label={label}
				aria-expanded={open}
				aria-describedby={open ? bubbleId : undefined}
				onClick={() => setOpen((value) => !value)}
			>
				<svg
					viewBox="0 0 20 20"
					width="18"
					height="18"
					aria-hidden="true"
					focusable="false"
				>
					<circle
						cx="10"
						cy="10"
						r="9"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.6"
					/>
					<circle cx="10" cy="6" r="1.15" fill="currentColor" />
					<rect
						x="9.1"
						y="8.6"
						width="1.8"
						height="6"
						rx="0.9"
						fill="currentColor"
					/>
				</svg>
			</button>
			<span id={bubbleId} className="info-tip-bubble" role="tooltip">
				{text}
			</span>
		</span>
	);
}
