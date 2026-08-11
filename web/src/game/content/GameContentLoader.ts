import {
	type ContentManifestV1,
	ContentValidationError,
	GAME_CONTENT_VERSION,
	type GameContentRegistry,
	parseContentManifest,
	parseGameContentBundle,
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

type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

type MapLoadRequest = {
	promise: Promise<GameContentRegistry>;
	signal: AbortSignal | undefined;
};

const isAbortError = (error: unknown): boolean =>
	error instanceof DOMException
		? error.name === "AbortError"
		: error instanceof Error && error.name === "AbortError";

export class GameContentLoader {
	private registry: GameContentRegistry | null = null;
	private inFlight: Promise<GameContentRegistry> | null = null;
	private inFlightSignal: AbortSignal | undefined;
	private readonly mapLoads = new Map<string, MapLoadRequest>();
	private readonly controllers = new Set<AbortController>();
	private manifestRaw: unknown = null;
	private manifest: ContentManifestV1 | null = null;
	private readonly loadedMaps = new Map<string, RawContentDocument>();
	private readonly loadedEvents = new Map<string, RawContentDocument>();
	private generation = 0;

	constructor(
		private readonly contentVersion = GAME_CONTENT_VERSION,
		private readonly fetcher: FetchLike = fetch,
		private readonly timeoutMs = 10_000,
	) {}

	load(signal?: AbortSignal): Promise<GameContentRegistry> {
		if (this.registry) return Promise.resolve(this.registry);
		if (this.inFlight && signal === this.inFlightSignal) return this.inFlight;

		const generation = this.generation;
		const request = this.runRequest(signal, (requestSignal) =>
			this.fetchBundle(requestSignal),
		)
			.then((registry) => {
				if (generation === this.generation) this.registry = registry;
				return registry;
			})
			.finally(() => {
				if (this.inFlight === request) {
					this.inFlight = null;
					this.inFlightSignal = undefined;
				}
			});
		this.inFlight = request;
		this.inFlightSignal = signal;
		return request;
	}

	async loadMap(
		mapId: string,
		signal?: AbortSignal,
	): Promise<GameContentRegistry> {
		const initial = await this.load(signal);
		if (initial.mapsById[mapId]) return initial;
		const existing = this.mapLoads.get(mapId);
		if (existing && existing.signal === signal) return existing.promise;
		const generation = this.generation;
		const request = this.runRequest(signal, async (requestSignal) => {
			const manifest = this.requireManifest();
			const bundle = manifest.bundles.find((candidate) =>
				candidate.maps.some(({ id }) => id === mapId),
			);
			if (!bundle) {
				throw new ContentLoadError(
					"reference",
					`World map '${mapId}' is not declared by any content bundle.`,
					false,
				);
			}
			await this.fetchBundleDocuments(bundle.id, requestSignal);
			const registry = this.buildRegistry();
			if (!registry.mapsById[mapId]) {
				throw new ContentLoadError(
					"reference",
					`World map '${mapId}' was not provided by its content bundle.`,
					false,
				);
			}
			return registry;
		})
			.then((registry) => {
				if (generation === this.generation) this.registry = registry;
				return registry;
			})
			.finally(() => {
				if (this.mapLoads.get(mapId)?.promise === request) {
					this.mapLoads.delete(mapId);
				}
			});
		this.mapLoads.set(mapId, { promise: request, signal });
		return request;
	}

	hasDeclaredMap(mapId: string): boolean | null {
		if (!this.manifest) return null;
		return this.manifest.bundles.some((bundle) =>
			bundle.maps.some(({ id }) => id === mapId),
		);
	}

	reset(): void {
		this.generation += 1;
		for (const controller of this.controllers) controller.abort();
		this.controllers.clear();
		this.inFlight = null;
		this.inFlightSignal = undefined;
		this.mapLoads.clear();
		this.registry = null;
		this.manifestRaw = null;
		this.manifest = null;
		this.loadedMaps.clear();
		this.loadedEvents.clear();
	}

	private async fetchBundle(signal: AbortSignal): Promise<GameContentRegistry> {
		const manifestRaw = await this.fetchJson(
			`${this.baseUrl}/manifest.json`,
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
		this.manifestRaw = manifestRaw;
		this.manifest = manifest;
		await this.fetchBundleDocuments(manifest.entryBundleId, signal);
		const registry = this.buildRegistry();
		if (!registry.mapsById[manifest.entryPoint.mapId]) {
			throw new ContentLoadError(
				"reference",
				"The entry content bundle did not provide the entry map.",
				false,
			);
		}
		return registry;
	}

	private async fetchBundleDocuments(
		bundleId: string,
		signal: AbortSignal,
	): Promise<void> {
		const manifest = this.requireManifest();
		const bundle = manifest.bundles.find(({ id }) => id === bundleId);
		if (!bundle) {
			throw new ContentLoadError(
				"reference",
				`Content bundle '${bundleId}' does not exist.`,
				false,
			);
		}
		const fetchMissing = async (
			documents: readonly { path: string }[],
			cache: Map<string, RawContentDocument>,
		): Promise<void> => {
			await Promise.all(
				documents.map(async ({ path }) => {
					if (cache.has(path)) return;
					cache.set(path, {
						path,
						data: await this.fetchJson(`${this.baseUrl}/${path}`, signal),
					});
				}),
			);
		};
		await Promise.all([
			fetchMissing(bundle.maps, this.loadedMaps),
			fetchMissing(bundle.events, this.loadedEvents),
		]);
	}

	private buildRegistry(): GameContentRegistry {
		return parseGameContentBundle(
			{
				manifest: this.manifestRaw,
				maps: [...this.loadedMaps.values()],
				events: [...this.loadedEvents.values()],
			},
			{ allowPartial: true },
		);
	}

	private requireManifest(): ContentManifestV1 {
		if (!this.manifest) {
			throw new ContentLoadError(
				"reference",
				"The world manifest has not been loaded.",
				false,
			);
		}
		return this.manifest;
	}

	private runRequest(
		signal: AbortSignal | undefined,
		work: (signal: AbortSignal) => Promise<GameContentRegistry>,
	): Promise<GameContentRegistry> {
		const controller = new AbortController();
		this.controllers.add(controller);
		const onAbort = () => controller.abort();
		if (signal?.aborted) controller.abort();
		else signal?.addEventListener("abort", onAbort, { once: true });
		const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
		return work(controller.signal)
			.catch((error: unknown) => {
				throw this.normalizeError(error);
			})
			.finally(() => {
				clearTimeout(timeout);
				signal?.removeEventListener("abort", onAbort);
				this.controllers.delete(controller);
			});
	}

	private normalizeError(error: unknown): ContentLoadError {
		if (error instanceof ContentLoadError) return error;
		if (error instanceof ContentValidationError) {
			const code = error.issues.every((issue) => issue.code === "schema")
				? "schema"
				: "reference";
			return new ContentLoadError(
				code,
				"World data is invalid and could not be loaded.",
				false,
			);
		}
		return new ContentLoadError(
			"network",
			isAbortError(error)
				? "World loading timed out or was cancelled."
				: "The world could not be reached.",
		);
	}

	private get baseUrl(): string {
		return `/game-content/${this.contentVersion}`;
	}

	private async fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
		let response: Response;
		try {
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
