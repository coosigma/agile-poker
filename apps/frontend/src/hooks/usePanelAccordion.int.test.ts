import { act, cleanup, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { type PanelMeasureRefs, usePanelAccordion } from './usePanelAccordion';

const originalResizeObserver = globalThis.ResizeObserver;
let resizeCallbacks: ResizeObserverCallback[] = [];

class MockResizeObserver implements ResizeObserver {
	constructor(callback: ResizeObserverCallback) {
		resizeCallbacks.push(callback);
	}

	disconnect() {}
	observe() {}
	unobserve() {}
}

function elementRef<T extends Element>(element: T): RefObject<T> {
	return { current: element };
}

function setDimension(
	element: Element,
	property: 'clientHeight' | 'scrollHeight',
	value: number,
) {
	Object.defineProperty(element, property, { configurable: true, value });
}

function panelRefs(headerHeight: number, bodyHeight: number): PanelMeasureRefs {
	const panel = document.createElement('div');
	const header = document.createElement('div');
	const body = document.createElement('div');
	panel.append(header, body);
	document.body.append(panel);
	header.getBoundingClientRect = () => ({ height: headerHeight }) as DOMRect;
	setDimension(body, 'scrollHeight', bodyHeight);
	return {
		header: elementRef(header),
		body: elementRef(body),
	};
}

beforeEach(() => {
	resizeCallbacks = [];
	globalThis.ResizeObserver = MockResizeObserver;
});

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
	globalThis.ResizeObserver = originalResizeObserver;
});

describe('usePanelAccordion', () => {
	// Integration-level regression: React state, DOM measurements, and the
	// ResizeObserver boundary collaborate to reproduce the viewport behaviour.
	test('keeps a manually opened history panel visible after remeasurement', () => {
		const container = document.createElement('aside');
		document.body.append(container);
		setDimension(container, 'clientHeight', 100);
		const containerRef = elementRef(container);
		const refs = {
			control: panelRefs(10, 50),
			history: panelRefs(10, 80),
		};
		const panelIds = ['control', 'history'];
		const openPriority = ['control'];
		const closePriority = ['history', 'control'];

		const { result } = renderHook(() =>
			usePanelAccordion(
				containerRef,
				refs,
				panelIds,
				openPriority,
				closePriority,
			),
		);

		expect(result.current.isAccordion).toBe(true);
		expect(result.current.isPanelOpen('control')).toBe(true);
		expect(result.current.isPanelOpen('history')).toBe(false);

		act(() => result.current.togglePanel('history'));
		expect(result.current.isPanelOpen('history')).toBe(true);
		expect(result.current.isPanelOpen('control')).toBe(false);

		act(() => {
			resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
		});
		expect(result.current.isPanelOpen('history')).toBe(true);
	});
});
