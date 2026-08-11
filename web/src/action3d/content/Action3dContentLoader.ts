import {
	ACTION3D_CONTENT_VERSION,
	Action3dContentError,
	type Action3dContentRegistry,
	parseAction3dBundle,
	parseAction3dManifest,
	parseAction3dWorld,
} from "@shared/action3d";

export class Action3dContentLoadError extends Error {
	constructor(
		readonly kind: "network" | "invalid",
		message: string,
	) {
		super(message);
		this.name = "Action3dContentLoadError";
	}
}
export type Action3dFetcher = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;
export type Action3dContentProgress = {
	loaded: number;
	total: number;
	label: string;
};
const jsonResponse = async (
	response: Response,
	label: string,
): Promise<unknown> => {
	if (!response.ok)
		throw new Action3dContentLoadError(
			"network",
			`${label} returned HTTP ${response.status}.`,
		);
	try {
		return await response.json();
	} catch {
		throw new Action3dContentLoadError(
			"invalid",
			`${label} is not valid JSON.`,
		);
	}
};

export class Action3dContentLoader {
	private pending: Promise<Action3dContentRegistry> | null = null;
	private readonly pendingWorlds = new Map<string, Promise<void>>();
	constructor(
		private readonly fetcher: Action3dFetcher = (input, init) =>
			fetch(input, init),
	) {}
	load(
		signal?: AbortSignal,
		onProgress?: (progress: Action3dContentProgress) => void,
	): Promise<Action3dContentRegistry> {
		if (!this.pending) {
			const report = (progress: Action3dContentProgress) => {
				if (!signal?.aborted) onProgress?.(progress);
			};
			const pending = this.loadFresh(report).catch((error) => {
				if (this.pending === pending) this.pending = null;
				throw error;
			});
			this.pending = pending;
		}
		return this.withAbort(this.pending, signal);
	}
	reset(): void {
		this.pending = null;
		this.pendingWorlds.clear();
	}
	async loadWorld(
		registry: Action3dContentRegistry,
		worldId: string,
		signal?: AbortSignal,
		onProgress?: (progress: Action3dContentProgress) => void,
	): Promise<void> {
		if (registry.hasWorld(worldId)) return;
		let pending = this.pendingWorlds.get(worldId);
		if (!pending) {
			pending = this.loadWorldFresh(registry, worldId, onProgress).catch(
				(error) => {
					this.pendingWorlds.delete(worldId);
					throw error;
				},
			);
			this.pendingWorlds.set(worldId, pending);
		}
		await this.withAbort(
			pending.then(() => registry),
			signal,
		);
	}
	private async loadWorldFresh(
		registry: Action3dContentRegistry,
		worldId: string,
		onProgress?: (progress: Action3dContentProgress) => void,
	): Promise<void> {
		const path = registry.getWorldDocumentPath(worldId);
		const root = `/action3d-content/${ACTION3D_CONTENT_VERSION}`;
		try {
			onProgress?.({ loaded: 0, total: 1, label: path });
			const data = await jsonResponse(
				await this.fetcher(`${root}/${path}`),
				`Action3D world ${path}`,
			);
			const world = parseAction3dWorld(data, path);
			if (world.id !== worldId)
				throw new Action3dContentLoadError(
					"invalid",
					`Action3D world '${path}' declares an unexpected ID.`,
				);
			registry.registerWorld(world);
			onProgress?.({ loaded: 1, total: 1, label: path });
		} catch (error) {
			if (error instanceof Action3dContentLoadError) throw error;
			if (error instanceof Action3dContentError)
				throw new Action3dContentLoadError(
					"invalid",
					"The Action3D world data failed validation.",
				);
			throw new Action3dContentLoadError(
				"network",
				`The Action3D world could not be reached.${error instanceof Error ? ` ${error.message}` : ""}`,
			);
		}
	}
	private withAbort(
		pending: Promise<Action3dContentRegistry>,
		signal?: AbortSignal,
	): Promise<Action3dContentRegistry> {
		if (!signal) return pending;
		if (signal.aborted) {
			void pending.catch(() => undefined);
			return Promise.reject(new DOMException("Aborted", "AbortError"));
		}
		return new Promise((resolve, reject) => {
			const aborted = () => reject(new DOMException("Aborted", "AbortError"));
			signal.addEventListener("abort", aborted, { once: true });
			void pending.then(resolve, reject).finally(() => {
				signal.removeEventListener("abort", aborted);
			});
		});
	}
	private async loadFresh(
		onProgress: (progress: Action3dContentProgress) => void,
	): Promise<Action3dContentRegistry> {
		const root = `/action3d-content/${ACTION3D_CONTENT_VERSION}`;
		try {
			onProgress({ loaded: 0, total: 1, label: "Manifest" });
			const rawManifest = await jsonResponse(
				await this.fetcher(`${root}/manifest.json`),
				"Action3D manifest",
			);
			const manifest = parseAction3dManifest(rawManifest);
			const total = 2;
			onProgress({ loaded: 1, total, label: "Manifest" });
			const entry = manifest.documents.worlds.find(
				(document) => document.id === manifest.entryPoint.worldId,
			);
			if (!entry)
				throw new Action3dContentLoadError(
					"invalid",
					"The Action3D entry world is not declared.",
				);
			const data = await jsonResponse(
				await this.fetcher(`${root}/${entry.path}`),
				`Action3D world ${entry.path}`,
			);
			onProgress({ loaded: 2, total, label: entry.path });
			return parseAction3dBundle({
				manifest: rawManifest,
				worlds: [{ path: entry.path, data }],
				allowPartialWorlds: true,
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError")
				throw error;
			if (error instanceof Action3dContentLoadError) throw error;
			if (error instanceof Action3dContentError)
				throw new Action3dContentLoadError(
					"invalid",
					"The Action3D world data failed validation.",
				);
			throw new Action3dContentLoadError(
				"network",
				`The Action3D field could not be reached.${error instanceof Error ? ` ${error.message}` : ""}`,
			);
		}
	}
}
