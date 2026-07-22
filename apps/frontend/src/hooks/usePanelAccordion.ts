import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const OVERFLOW_EPSILON_PX = 4;

export interface PanelMeasureRefs {
	readonly header: RefObject<HTMLDivElement | null>;
	readonly body: RefObject<HTMLDivElement | null>;
}

interface PanelMeasurement {
	readonly headerHeight: number;
	readonly bodyHeight: number;
	readonly paddingPx: number;
}

/**
 * Measures whether a side panel's fully-expanded content would overflow its
 * available height, and if so, drives an accordion mode: panels become
 * collapsible. `openPriority` lists the panels considered for auto-opening,
 * ordered from highest to lowest priority; panels not listed always start
 * closed. As long as the user hasn't manually toggled anything, the hook
 * keeps re-deriving the best-fitting default open set on every measurement:
 * it walks `openPriority` in order and opens each panel only while doing so
 * still fits the available height, so as the viewport gets shorter, lower
 * priority panels (e.g. "Room info" after "Voting controls") automatically
 * collapse on their own — no fixed breakpoint, purely measured height.
 *
 * The user may freely open/close any panel afterwards. When they *open* one
 * manually and the resulting combination doesn't fit, other currently-open
 * panels are auto-closed (per `closePriority`, most dispensable first,
 * never the panel the user just opened) so the newly opened panel is
 * visible without a scrollbar. The same shrink-to-fit is re-applied on
 * every measurement (e.g. the viewport getting shorter) so a manual
 * selection that no longer fits keeps shedding panels by that same
 * priority rather than showing a scrollbar. This never *reopens* a panel
 * the user closed — it only ever removes, so intent is respected as much
 * as space allows.
 *
 * Auto-adjustment (both the fresh default and the shrink-to-fit) resets
 * whenever accordion mode turns off and back on, or the set of available
 * panels changes (e.g. a host transfer adds/removes the "control" panel).
 *
 * Overflow is measured from each panel's natural (uncollapsed) header/body
 * height, independent of whether it is currently collapsed, so toggling
 * panels open/closed never itself changes the overflow verdict. Per-panel
 * padding and the gap between panels are read live via `getComputedStyle`
 * (rather than assumed from hardcoded constants), since `styles.css` steps
 * those values down through media-query buckets on short viewports.
 *
 * Refs are supplied by the caller (created with `useRef` and attached to
 * plain `ref={...}` props) rather than returned from this hook, so refs are
 * only ever read inside effects, never during render.
 */
export function usePanelAccordion(
	containerRef: RefObject<HTMLElement | null>,
	panelRefs: Readonly<Record<string, PanelMeasureRefs>>,
	panelIds: readonly string[],
	openPriority: readonly string[],
	closePriority: readonly string[],
) {
	const panelIdsKey = panelIds.join('|');
	const [isAccordion, setIsAccordion] = useState(false);
	const [openPanelIds, setOpenPanelIds] = useState<string[]>([]);

	// Tracks whether the user has manually toggled a panel since the last
	// fresh default; while false, recompute() keeps re-deriving the
	// best-fit open set as the container is resized.
	const manualOverrideRef = useRef(false);
	const isAccordionRef = useRef(false);
	const compositionKeyRef = useRef<string | null>(null);

	// Latest measurements, kept up to date by recompute() so togglePanel can
	// synchronously decide what still fits without waiting for a re-render.
	const measurementsRef = useRef<Map<string, PanelMeasurement>>(new Map());
	const availableRef = useRef(0);
	const gapPxRef = useRef(0);

	const computeRequired = useCallback(
		(openSet: readonly string[]) => {
			let total = 0;
			panelIds.forEach((id, index) => {
				const m = measurementsRef.current.get(id);
				total += (m?.headerHeight ?? 0) + (m?.paddingPx ?? 0);
				if (openSet.includes(id)) {
					total += m?.bodyHeight ?? 0;
				}
				if (index > 0) {
					total += gapPxRef.current;
				}
			});
			return total;
		},
		[panelIds],
	);

	// Closes panels (per closePriority, most dispensable first) from openSet
	// until it fits the available height, never removing `protectedId`.
	const shrinkToFit = useCallback(
		(openSet: readonly string[], protectedId?: string) => {
			let result = [...openSet];
			for (const candidate of closePriority) {
				if (
					computeRequired(result) <=
					availableRef.current + OVERFLOW_EPSILON_PX
				) {
					break;
				}
				if (candidate === protectedId) {
					continue;
				}
				if (result.includes(candidate)) {
					result = result.filter((id) => id !== candidate);
				}
			}
			return result;
		},
		[closePriority, computeRequired],
	);

	const recompute = useCallback(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const available = container.clientHeight;
		const gapPx = parseFloat(getComputedStyle(container).rowGap) || 0;
		const measurements = new Map<string, PanelMeasurement>();
		let required = 0;
		panelIds.forEach((id, index) => {
			const refs = panelRefs[id];
			const headerEl = refs?.header.current ?? null;
			const bodyEl = refs?.body.current ?? null;
			const headerHeight = headerEl?.getBoundingClientRect().height ?? 0;
			const bodyHeight = bodyEl?.scrollHeight ?? 0;
			// The panel wrapper is the header's parent element; read its live
			// vertical padding rather than assuming a fixed value.
			const panelEl = headerEl?.parentElement ?? null;
			let paddingPx = 0;
			if (panelEl) {
				const style = getComputedStyle(panelEl);
				paddingPx =
					(parseFloat(style.paddingTop) || 0) +
					(parseFloat(style.paddingBottom) || 0);
			}
			measurements.set(id, { headerHeight, bodyHeight, paddingPx });
			required += headerHeight + bodyHeight + paddingPx;
			if (index > 0) {
				required += gapPx;
			}
		});
		measurementsRef.current = measurements;
		availableRef.current = available;
		gapPxRef.current = gapPx;

		const willBeAccordion = required > available + OVERFLOW_EPSILON_PX;
		const compositionKey = panelIdsKey;
		const enteringAccordion = willBeAccordion && !isAccordionRef.current;
		const compositionChanged = compositionKeyRef.current !== compositionKey;
		if (!willBeAccordion || enteringAccordion || compositionChanged) {
			manualOverrideRef.current = false;
		}
		compositionKeyRef.current = compositionKey;
		isAccordionRef.current = willBeAccordion;
		setIsAccordion(willBeAccordion);

		if (!willBeAccordion) {
			return;
		}

		if (!manualOverrideRef.current) {
			// Baseline: every panel collapsed to just its header.
			let closedTotal = 0;
			panelIds.forEach((id, index) => {
				const m = measurements.get(id);
				closedTotal += (m?.headerHeight ?? 0) + (m?.paddingPx ?? 0);
				if (index > 0) {
					closedTotal += gapPx;
				}
			});
			let remaining = available - closedTotal;
			const openSet: string[] = [];
			for (const id of openPriority) {
				if (!panelIds.includes(id)) {
					continue;
				}
				const bodyHeight = measurements.get(id)?.bodyHeight ?? 0;
				// Always let the top-priority panel open even if it alone
				// doesn't fit, so accordion mode never opens with nothing
				// expanded; lower-priority panels only join while they fit.
				if (
					openSet.length === 0 ||
					remaining - bodyHeight >= -OVERFLOW_EPSILON_PX
				) {
					openSet.push(id);
					remaining -= bodyHeight;
				} else {
					break;
				}
			}
			setOpenPanelIds(openSet);
		} else {
			// Manual selection is already in place; only ever shed panels (by
			// closePriority) if it stops fitting — never add any back.
			setOpenPanelIds((previous) => {
				const fitted = shrinkToFit(previous);
				return fitted.length === previous.length &&
					fitted.every((id, index) => id === previous[index])
					? previous
					: fitted;
			});
		}
		// panelRefs holds stable ref objects (identity fixed by the caller via
		// useRef), so it deliberately isn't tracked as a dependency here.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [panelIds, panelIdsKey, openPriority, containerRef, shrinkToFit]);

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

	// No capacity cap: any panel may be freely opened or closed. Opening a
	// panel may auto-close others (per closePriority) to keep the newly
	// opened panel visible without a scrollbar; closing one never triggers
	// side effects.
	const togglePanel = useCallback(
		(id: string) => {
			manualOverrideRef.current = true;
			setOpenPanelIds((previous) => {
				if (previous.includes(id)) {
					return previous.filter((existingId) => existingId !== id);
				}
				return shrinkToFit([...previous, id], id);
			});
		},
		[shrinkToFit],
	);

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
