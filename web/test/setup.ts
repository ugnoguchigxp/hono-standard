import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
	cleanup();
});

// jsdom has no native dialog methods; real focus/Escape behavior is covered by Playwright.
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
	configurable: true,
	value: function (this: HTMLDialogElement) {
		this.setAttribute("open", "");
	},
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
	configurable: true,
	value: function (this: HTMLDialogElement) {
		if (!this.open) return;
		this.removeAttribute("open");
		this.dispatchEvent(new Event("close"));
	},
});
