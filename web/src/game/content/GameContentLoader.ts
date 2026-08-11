import {
	ContentValidationError,
	GAME_CONTENT_VERSION,
	parseContentManifest,
	parseGameContentBundle,
	type GameContentRegistry,
	type RawContentDocument,
} from "@shared/game";

export type ContentLoadErrorCode =
	| "network"
	| "http"
	| "parse"
	| "schema"
	| "reference"
	| "incompatible-version";

export class ContentLoadError extends Error {
	readonly code: ContentLoadErrorCode;
	readonly retryable: boolean;

	constructor(code: ContentLoadErrorCode, message: string, retryable = true) {
		super(message);
		this.name = "ContentLoadError";
		this.code = code;
		this.retryable = retryable;
	}
}

type FetchLike = typeof fetch;

const isAbortError = (error: unknown): boolean =>
	error instanceof DOMException
		? error.name === "AbortError"
		: error instanceof Error && error.name === "AbortError";

export class GameContentLoader {
	private registry: GameContentRegistry | null = null;
	private inFlight: Promise<GameContentRegistry> | null = null;
	private controller: AbortController | null = null;

	constructor(
		private readonly contentVersion = GAME_CONTENT_VERSION,
		private readonly fetcher: FetchLike = fetch,
		private readonly timeoutMs = 10_000,
	) {}

	load(signal?: AbortSignal): Promise<GameContentRegistry> {
		if (this.registry) return Promise.resolve(this.registry);
		if (this.inFlight && !this.controller?.signal.aborted) return this.inFlight;

		const controller = new AbortController();
		this.controller = controller;
		const onAbort = () => controller.abort();
		if (signal?.aborted) controller.abort();
		else signal?.addEventListener("abort", onAbort, { once: true });
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

		const request = this.fetchBundle(controller.signal)
			.then((registry) => {
				// A reset can be followed by a new request before an older custom
				// fetcher settles. Never let that stale request replace the new cache.
				if (this.controller === controller && !controller.signal.aborted) {
					this.registry = registry;
				}
				return registry;
			})
			.catch((error: unknown) => {
				if (error instanceof ContentLoadError) throw error;
				if (error instanceof ContentValidationError) {
					const code = error.issues.every((issue) => issue.code === "schema")
						? "schema"
						: "reference";
					throw new ContentLoadError(
						code,
						"World data is invalid and could not be loaded.",
						false,
					);
				}
				throw new ContentLoadError(
					"network",
					isAbortError(error)
						? "World loading timed out or was cancelled."
						: "The world could not be reached.",
				);
			})
			.finally(() => {
				clearTimeout(timeout);
				signal?.removeEventListener("abort", onAbort);
				if (this.inFlight === request) this.inFlight = null;
				if (this.controller === controller) this.controller = null;
			});
		this.inFlight = request;
		return request;
	}

	reset(): void {
		this.controller?.abort();
		this.controller = null;
		this.inFlight = null;
		this.registry = null;
	}

	private async fetchBundle(signal: AbortSignal): Promise<GameContentRegistry> {
		const baseUrl = `/game-content/${this.contentVersion}`;
		const manifestRaw = await this.fetchJson(
			`${baseUrl}/manifest.json`,
			signal,
		);
		const manifest = parseContentManifest(manifestRaw);
		if (manifest.contentVersion !== this.contentVersion) {
			throw new ContentLoadError(
				"incompatible-version",
				"The downloaded world version is not compatible with this game.",
				false,
			);
		}
		const loadDocuments = async (
			paths: readonly string[],
		): Promise<RawContentDocument[]> =>
			Promise.all(
				paths.map(async (path) => ({
					path,
					data: await this.fetchJson(`${baseUrl}/${path}`, signal),
				})),
			);
		const [maps, events] = await Promise.all([
			loadDocuments(manifest.documents.maps),
			loadDocuments(manifest.documents.events),
		]);
		return parseGameContentBundle({
			manifest: manifestRaw,
			maps,
			events,
		});
	}

	private async fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
		let response: Response;
		try {
			// Native browser functions such as window.fetch must not inherit the
			// loader instance as their receiver (Chrome throws "Illegal invocation").
			const fetcher = this.fetcher;
			response = await fetcher(url, { signal });
		} catch (error) {
			if (isAbortError(error)) throw error;
			throw new ContentLoadError("network", "The world could not be reached.");
		}
		if (!response.ok) {
			throw new ContentLoadError(
				"http",
				`World data request failed with status ${response.status}.`,
			);
		}
		try {
			return await response.json();
		} catch {
			throw new ContentLoadError(
				"parse",
				"World data could not be read as JSON.",
				false,
			);
		}
	}
}
