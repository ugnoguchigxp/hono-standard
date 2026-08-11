import {
	ACTION3D_CONTENT_VERSION,
	Action3dContentError,
	type Action3dContentRegistry,
	parseAction3dBundle,
	parseAction3dManifest,
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
			const total = manifest.documents.worlds.length + 1;
			onProgress({ loaded: 1, total, label: "Manifest" });
			let loaded = 1;
			const worlds = await Promise.all(
				manifest.documents.worlds.map(async (path) => {
					const data = await jsonResponse(
						await this.fetcher(`${root}/${path}`),
						`Action3D world ${path}`,
					);
					loaded += 1;
					onProgress({ loaded, total, label: path });
					return { path, data };
				}),
			);
			return parseAction3dBundle({ manifest: rawManifest, worlds });
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
