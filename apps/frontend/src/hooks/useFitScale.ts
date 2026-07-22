import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Measures a content element's natural (unscaled) height against its
 * container's available height and returns a uniform scale factor (<= 1)
 * so the content can be shrunk proportionally to fit without needing a
 * scrollbar. Re-measured live via `ResizeObserver` whenever the container
 * or content size changes — no fixed breakpoints.
 *
 * `contentRef` should point at an element whose CSS applies
 * `transform: scale(...)` (which doesn't affect layout size), so its
 * `scrollHeight` always reflects the natural, un-shrunk height.
 *
 * `minScale` sets a floor so content never shrinks into illegibility; if
 * the natural height still exceeds the container even at that floor, the
 * caller's container should keep a scroll fallback for that edge case.
 *
 * Refs are supplied by the caller (created with `useRef`) rather than
 * returned from this hook, consistent with `usePanelAccordion`.
 */
export function useFitScale(
	containerRef: RefObject<HTMLElement | null>,
	contentRef: RefObject<HTMLElement | null>,
	minScale = 0.6,
) {
	const [scale, setScale] = useState(1);

	const recompute = useCallback(() => {
		const container = containerRef.current;
		const content = contentRef.current;
		if (!container || !content) {
			return;
		}
		const available = container.clientHeight;
		const natural = content.scrollHeight;
		if (available <= 0 || natural <= 0) {
			setScale(1);
			return;
		}
		const nextScale = Math.min(1, available / natural);
		setScale(Math.max(minScale, nextScale));
		// containerRef/contentRef are stable ref objects (identity fixed by
		// the caller via useRef), so they deliberately aren't tracked here.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [minScale]);

	useEffect(() => {
		recompute();
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(() => recompute());
		if (containerRef.current) {
			observer.observe(containerRef.current);
		}
		if (contentRef.current) {
			observer.observe(contentRef.current);
		}
		return () => observer.disconnect();
		// containerRef/contentRef are stable ref objects (identity fixed by
		// the caller via useRef), so they deliberately aren't tracked here.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [recompute]);

	return scale;
}
