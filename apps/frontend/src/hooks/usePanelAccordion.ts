import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const PANEL_GAP_PX = 12;
// Matches the `.panel` rule's vertical padding (16px top + 16px bottom).
const PANEL_VERTICAL_PADDING_PX = 32;
const OVERFLOW_EPSILON_PX = 4;

export interface PanelMeasureRefs {
	readonly header: RefObject<HTMLDivElement | null>;
	readonly body: RefObject<HTMLDivElement | null>;
}

/**
 * Measures whether a side panel's fully-expanded content would overflow its
 * available height, and if so, drives an accordion mode: panels become
 * collapsible, opening `defaultOpenIds` by default. The user may freely
 * open/close any panel afterwards — there is no forced eviction. If the
 * currently open panels' combined natural height still exceeds the
 * available space, the accordion CSS (`.panel-open` gets `flex: 1 1 auto` +
 * an internally scrollable body) shares out the remaining space and scrolls
 * individual panels rather than ever overflowing the page.
 *
 * Overflow is measured from each panel's natural (uncollapsed) header/body
 * height, independent of whether it is currently collapsed, so toggling
 * panels open/closed never itself changes the overflow verdict.
 *
 * Refs are supplied by the caller (created with `useRef` and attached to
 * plain `ref={...}` props) rather than returned from this hook, so refs are
 * only ever read inside effects, never during render.
 */
export function usePanelAccordion(
	containerRef: RefObject<HTMLElement | null>,
	panelRefs: Readonly<Record<string, PanelMeasureRefs>>,
	panelIds: readonly string[],
	defaultOpenIds: readonly string[],
) {
	const panelIdsKey = panelIds.join('|');
	const defaultOpenIdsKey = defaultOpenIds.join('|');
	const [isAccordion, setIsAccordion] = useState(false);
	const [openPanelIds, setOpenPanelIds] = useState<string[]>([]);

	const recompute = useCallback(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const available = container.clientHeight;
		let required = 0;
		panelIds.forEach((id, index) => {
			const refs = panelRefs[id];
			const headerHeight =
				refs?.header.current?.getBoundingClientRect().height ?? 0;
			const bodyHeight = refs?.body.current?.scrollHeight ?? 0;
			required += headerHeight + bodyHeight + PANEL_VERTICAL_PADDING_PX;
			if (index > 0) {
				required += PANEL_GAP_PX;
			}
		});
		setIsAccordion(required > available + OVERFLOW_EPSILON_PX);
		// panelRefs holds stable ref objects (identity fixed by the caller via
		// useRef), so it deliberately isn't tracked as a dependency here.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [panelIds, containerRef]);

	useEffect(() => {
		recompute();
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		const observer = new ResizeObserver(() => recompute());
		if (containerRef.current) {
			observer.observe(containerRef.current);
		}
		panelIds.forEach((id) => {
			const refs = panelRefs[id];
			if (refs?.header.current) {
				observer.observe(refs.header.current);
			}
			if (refs?.body.current) {
				observer.observe(refs.body.current);
			}
		});
		return () => observer.disconnect();
		// panelIdsKey covers panelIds identity changes; panelRefs' ref objects
		// are stable across renders (created once by the caller).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [panelIdsKey, recompute, containerRef]);

	// Apply the default open set whenever accordion mode turns on, or whenever
	// the set of available panels changes while accordion mode is already on
	// (e.g. a host transfer adds/removes the "control" panel). This is a
	// deliberate reset rather than a merge: panel composition changes are rare,
	// and preferring a fresh, predictable default over partially-stale manual
	// selections keeps behavior easy to reason about.
	const resetKeyRef = useRef<string | null>(null);
	useEffect(() => {
		if (!isAccordion) {
			resetKeyRef.current = null;
			return;
		}
		if (resetKeyRef.current !== panelIdsKey) {
			resetKeyRef.current = panelIdsKey;
			setOpenPanelIds(
				defaultOpenIds.filter((id) => panelIds.includes(id)) as string[],
			);
		}
		// defaultOpenIdsKey mirrors defaultOpenIds' identity for this effect's
		// purposes; the array itself is recreated each render by the caller.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAccordion, panelIdsKey, panelIds, defaultOpenIdsKey]);

	// No capacity cap: any panel may be freely opened or closed. When the open
	// set's natural content still exceeds the available height, CSS (not JS)
	// keeps it from overflowing the page by letting open panels share/shrink
	// the remaining space and scroll internally.
	const togglePanel = useCallback((id: string) => {
		setOpenPanelIds((previous) =>
			previous.includes(id)
				? previous.filter((existingId) => existingId !== id)
				: [...previous, id],
		);
	}, []);

	const isPanelOpen = useCallback(
		(id: string) => !isAccordion || openPanelIds.includes(id),
		[isAccordion, openPanelIds],
	);

	return {
		isAccordion,
		isPanelOpen,
		togglePanel,
	};
}
