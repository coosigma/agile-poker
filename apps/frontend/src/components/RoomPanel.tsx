import type { ReactNode } from 'react';

interface RoomPanelProps {
	readonly title: ReactNode;
	readonly badge?: ReactNode;
	readonly actions?: ReactNode;
	readonly className?: string;
	readonly children: ReactNode;
}

export function RoomPanel({
	title,
	badge,
	actions,
	className,
	children,
}: RoomPanelProps) {
	return (
		<div className={['panel', className].filter(Boolean).join(' ')}>
			<div className="panel-header">
				<h3>{title}</h3>
				{actions ?? badge}
			</div>
			{children}
		</div>
	);
}
