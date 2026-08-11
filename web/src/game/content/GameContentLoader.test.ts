import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ContentLoadError,
	GameContentLoader,
} from "./GameContentLoader";

const root = path.join(
	process.cwd(),
	"web/public/game-content/data-driven-world-1",
);
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));
const validResponses = () => {
	const responses = new Map<string, unknown>();
	responses.set(
		"/game-content/data-driven-world-1/manifest.json",
		structuredClone(manifest),
	);
	for (const documentPath of [
		...manifest.documents.maps,
		...manifest.documents.events,
	]) {
		responses.set(
			`/game-content/data-driven-world-1/${documentPath}`,
			JSON.parse(readFileSync(path.join(root, documentPath), "utf8")),
		);
	}
	return responses;
};

const createFetcher = (responses = validResponses()) =>
	vi.fn(async (input: string | URL | Request) => {
		const url = String(input);
		if (!responses.has(url)) return new Response("missing", { status: 404 });
		return new Response(JSON.stringify(responses.get(url)), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	}) as unknown as typeof fetch;

afterEach(() => {
	vi.useRealTimers();
});

describe("GameContentLoader", () => {
	it("fetches, validates, and caches a complete bundle", async () => {
		const fetcher = createFetcher();
		const loader = new GameContentLoader("data-driven-world-1", fetcher);
		const firstPromise = loader.load();
		const sharedPromise = loader.load();
		expect(sharedPromise).toBe(firstPromise);
		const first = await firstPromise;
		const second = await loader.load();
		expect(first).toBe(second);
		expect(first.getMap("relay-camp").displayName).toBe("Relay Camp");
		expect(fetcher).toHaveBeenCalledTimes(7);
	});

	it("calls a browser-style fetch function without rebinding its receiver", async () => {
		const fetcher = createFetcher();
		const browserStyleFetcher = function (
			this: unknown,
			...args: Parameters<typeof fetch>
		) {
			expect(this).toBeUndefined();
			return fetcher(...args);
		} as typeof fetch;
		const loader = new GameContentLoader(
			"data-driven-world-1",
			browserStyleFetcher,
		);

		await expect(loader.load()).resolves.toMatchObject({
			contentVersion: "data-driven-world-1",
		});
	});

	it("classifies HTTP, JSON, network, and content version failures", async () => {
		const httpFetcher = vi.fn(async () => new Response("no", { status: 503 }));
		await expect(
			new GameContentLoader(
				"data-driven-world-1",
				httpFetcher as unknown as typeof fetch,
			).load(),
		).rejects.toMatchObject({ code: "http", retryable: true });

		const parseFetcher = vi.fn(async () =>
			new Response("not-json", { status: 200 }),
		);
		await expect(
			new GameContentLoader(
				"data-driven-world-1",
				parseFetcher as unknown as typeof fetch,
			).load(),
		).rejects.toMatchObject({ code: "parse", retryable: false });

		const networkFetcher = vi.fn(async () => {
			throw new TypeError("offline");
		});
		await expect(
			new GameContentLoader(
				"data-driven-world-1",
				networkFetcher as unknown as typeof fetch,
			).load(),
		).rejects.toMatchObject({ code: "network" });

		const responses = validResponses();
		const incompatible = structuredClone(manifest);
		incompatible.contentVersion = "another-world";
		responses.set(
			"/game-content/data-driven-world-1/manifest.json",
			incompatible,
		);
		await expect(
			new GameContentLoader(
				"data-driven-world-1",
				createFetcher(responses),
			).load(),
		).rejects.toMatchObject({
			code: "incompatible-version",
			retryable: false,
		});
	});

	it("separates schema failures from cross-reference failures", async () => {
		const schemaResponses = validResponses();
		const invalidManifest = structuredClone(manifest);
		invalidManifest.assets[0].url = "https://example.com/image.png";
		schemaResponses.set(
			"/game-content/data-driven-world-1/manifest.json",
			invalidManifest,
		);
		await expect(
			new GameContentLoader(
				"data-driven-world-1",
				createFetcher(schemaResponses),
			).load(),
		).rejects.toMatchObject({ code: "schema", retryable: false });

		const referenceResponses = validResponses();
		const relayMapPath = "/game-content/data-driven-world-1/maps/relay-camp.json";
		const relayMap = structuredClone(referenceResponses.get(relayMapPath)) as {
			backgroundAssetId: string;
		};
		relayMap.backgroundAssetId = "missing-asset";
		referenceResponses.set(relayMapPath, relayMap);
		await expect(
			new GameContentLoader(
				"data-driven-world-1",
				createFetcher(referenceResponses),
			).load(),
		).rejects.toMatchObject({ code: "reference", retryable: false });
	});

	it("aborts timed-out requests and can reset for a clean retry", async () => {
		vi.useFakeTimers();
		const hangingFetcher = vi.fn(
			(_input: string | URL | Request, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("aborted", "AbortError"));
					});
				}),
		) as unknown as typeof fetch;
		const loader = new GameContentLoader(
			"data-driven-world-1",
			hangingFetcher,
			25,
		);
		const request = loader.load();
		const rejection = expect(request).rejects.toMatchObject({ code: "network" });
		await vi.advanceTimersByTimeAsync(25);
		await rejection;

		loader.reset();
		const fetcher = createFetcher();
		const retryLoader = new GameContentLoader("data-driven-world-1", fetcher);
		retryLoader.reset();
		await expect(retryLoader.load()).resolves.toMatchObject({
			contentVersion: "data-driven-world-1",
		});
	});

	it("honors a caller abort signal", async () => {
		const fetcher = vi.fn(
			(_input: string | URL | Request, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("aborted", "AbortError"));
					});
				}),
		) as unknown as typeof fetch;
		const controller = new AbortController();
		const loader = new GameContentLoader("data-driven-world-1", fetcher);
		const request = loader.load(controller.signal);
		const rejection = expect(request).rejects.toBeInstanceOf(ContentLoadError);
		controller.abort();
		await rejection;
	});

	it("does not let a request settled after reset overwrite the new cache", async () => {
		type Registry = Awaited<ReturnType<GameContentLoader["load"]>>;
		const staleRegistry = await new GameContentLoader(
			"data-driven-world-1",
			createFetcher(),
		).load();
		const freshRegistry = await new GameContentLoader(
			"data-driven-world-1",
			createFetcher(),
		).load();
		let resolveStale: ((registry: Registry) => void) | undefined;
		const loader = new GameContentLoader(
			"data-driven-world-1",
			createFetcher(),
		);
		const internals = loader as unknown as {
			fetchBundle: (signal: AbortSignal) => Promise<Registry>;
		};
		vi.spyOn(internals, "fetchBundle")
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveStale = resolve;
					}),
			)
			.mockResolvedValueOnce(freshRegistry);

		const staleRequest = loader.load();
		loader.reset();
		await expect(loader.load()).resolves.toBe(freshRegistry);
		resolveStale?.(staleRegistry);
		await expect(staleRequest).resolves.toBe(staleRegistry);
		await expect(loader.load()).resolves.toBe(freshRegistry);
	});

	it("classifies unexpected registry construction failures without exposing them", async () => {
		const responses = validResponses();
		const fetcher = createFetcher(responses);
		const originalStructuredClone = globalThis.structuredClone;
		vi.stubGlobal("structuredClone", () => {
			throw new Error("private registry detail");
		});
		try {
			await expect(
				new GameContentLoader("data-driven-world-1", fetcher).load(),
			).rejects.toMatchObject({
				code: "network",
				message: "The world could not be reached.",
			});
		} finally {
			vi.stubGlobal("structuredClone", originalStructuredClone);
		}
	});
});
