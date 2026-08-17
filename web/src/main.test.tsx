import { screen } from "@testing-library/react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./styles.css", () => ({}));

describe("web entrypoint", () => {
	let reactRoot: Root | undefined;

	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 401 })),
		);
	});

	afterEach(() => {
		reactRoot?.unmount();
		reactRoot = undefined;
		document.body.innerHTML = "";
		vi.unstubAllGlobals();
	});

	it("throws when imported without a root element", async () => {
		document.body.innerHTML = "";
		await expect(import("./main")).rejects.toThrow("Root element not found");
	});

	it("throws when mountApp is given a document without #root", async () => {
		document.body.innerHTML = '<div id="root"></div>';
		const { mountApp, webRoot } = await import("./main");
		reactRoot = webRoot;
		const empty = document.implementation.createHTMLDocument("empty");
		expect(() => mountApp(empty)).toThrow("Root element not found");
	});

	it("renders the app into #root", async () => {
		document.body.innerHTML = '<div id="root"></div>';
		const { webRoot } = await import("./main");
		reactRoot = webRoot;
		expect(
			await screen.findByRole("heading", { name: "Welcome to Hono Standard" }),
		).toBeVisible();
	});
});
