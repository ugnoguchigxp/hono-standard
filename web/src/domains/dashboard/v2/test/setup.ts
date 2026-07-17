import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(() => cleanup());

class TestResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}
class TestIntersectionObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

Object.assign(globalThis, {
	ResizeObserver: TestResizeObserver,
	IntersectionObserver: TestIntersectionObserver,
});
window.matchMedia ??= ((query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addListener: () => undefined,
	removeListener: () => undefined,
	addEventListener: () => undefined,
	removeEventListener: () => undefined,
	dispatchEvent: () => false,
})) as typeof window.matchMedia;
