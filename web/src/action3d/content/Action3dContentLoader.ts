import {
	ACTION3D_CONTENT_VERSION,
	Action3dContentError,
	parseAction3dBundle,
	parseAction3dManifest,
	type Action3dContentRegistry,
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
	constructor(private readonly fetcher: typeof fetch = fetch) {}
	load(signal?: AbortSignal): Promise<Action3dContentRegistry> {
		if (this.pending) return this.pending;
		this.pending = this.loadFresh(signal).catch((error) => {
			this.pending = null;
			throw error;
		});
		return this.pending;
	}
	reset(): void {
		this.pending = null;
	}
	private async loadFresh(
		signal?: AbortSignal,
	): Promise<Action3dContentRegistry> {
		const root = `/action3d-content/${ACTION3D_CONTENT_VERSION}`;
		try {
			const rawManifest = await jsonResponse(
				await this.fetcher(`${root}/manifest.json`, { signal }),
				"Action3D manifest",
			);
			const manifest = parseAction3dManifest(rawManifest);
			const worlds = await Promise.all(
				manifest.documents.worlds.map(async (path) => ({
					path,
					data: await jsonResponse(
						await this.fetcher(`${root}/${path}`, { signal }),
						`Action3D world ${path}`,
					),
				})),
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
				"The Action3D field could not be reached.",
			);
		}
	}
}
