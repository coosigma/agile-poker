import type { ReactNode, Ref } from 'react';

interface RoomPanelProps {
	readonly title: ReactNode;
	readonly badge?: ReactNode;
	readonly actions?: ReactNode;
	readonly className?: string;
	readonly children: ReactNode;
	/** Renders the panel as a collapsible accordion section (short-viewport mode). */
	readonly collapsible?: boolean;
	/** Whether the panel body is expanded. Ignored unless `collapsible` is set. */
	readonly open?: boolean;
	readonly onToggleOpen?: () => void;
	/** Measures the header's natural height for overflow detection. */
	readonly headerRef?: Ref<HTMLDivElement>;
	/** Measures the body's natural (uncollapsed) content height for overflow detection. */
	readonly bodyRef?: Ref<HTMLDivElement>;
}

export function RoomPanel({
	title,
	badge,
	actions,
	className,
	children,
	collapsible = false,
	open = true,
	onToggleOpen,
	headerRef,
	bodyRef,
}: RoomPanelProps) {
	const isOpen = !collapsible || open;
	return (
		<div
			className={[
				'panel',
				className,
				collapsible ? 'panel-collapsible' : null,
				isOpen ? 'panel-open' : 'panel-closed',
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div className="panel-header" ref={headerRef}>
				{collapsible ? (
					<button
						type="button"
						className="panel-header-toggle"
						aria-expanded={isOpen}
						onClick={onToggleOpen}
					>
						<h3>{title}</h3>
						<span className="panel-toggle-icon" aria-hidden="true">
							{isOpen ? '▾' : '▸'}
						</span>
					</button>
				) : (
					<h3>{title}</h3>
				)}
				{actions ?? badge}
			</div>
			<div
				className="panel-body-collapse"
				style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
			>
				<div className="panel-body" ref={bodyRef}>
					{children}
				</div>
			</div>
		</div>
	);
}
