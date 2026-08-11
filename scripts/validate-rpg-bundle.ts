import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

type ManifestEntry = {
	file: string;
	src?: string;
	isEntry?: boolean;
	isDynamicEntry?: boolean;
	imports?: string[];
	dynamicImports?: string[];
};

export const RPG_BUNDLE_BUDGETS = {
	applicationGzipBytes: 260 * 1024,
	gameRouteGzipBytes: 25 * 1024,
	phaserGzipBytes: 390 * 1024,
} as const;

export function validateRpgBundle(
	distRoot = path.resolve(process.cwd(), "dist-web"),
): {
	applicationGzipBytes: number;
	gameRouteGzipBytes: number;
	phaserGzipBytes: number;
	applicationFile: string;
	gameRouteFile: string;
	phaserFile: string;
} {
	const manifestPath = path.join(distRoot, ".vite", "manifest.json");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
		string,
		ManifestEntry
	>;
	const application = manifest["index.html"];
	const gameRoutePair = Object.entries(manifest).find(([, entry]) =>
		entry.src?.endsWith("/views/game-view.tsx"),
	);
	const phaserPair = Object.entries(manifest).find(([, entry]) =>
		entry.src?.endsWith("/game/PhaserGame.ts"),
	);
	if (!application?.isEntry || !gameRoutePair || !phaserPair) {
		throw new Error(
			"Could not identify the application, 2D game route, and Phaser build entries.",
		);
	}
	const [gameRouteKey, gameRoute] = gameRoutePair;
	const [phaserKey, phaser] = phaserPair;
	if (
		!gameRoute.isDynamicEntry ||
		!phaser.isDynamicEntry ||
		!application.dynamicImports?.includes(gameRouteKey) ||
		!gameRoute.dynamicImports?.includes(phaserKey)
	) {
		throw new Error(
			"The 2D route and Phaser must remain behind their launch boundaries.",
		);
	}
	if (
		application.imports?.includes(gameRouteKey) ||
		application.imports?.includes(phaserKey)
	) {
		throw new Error(
			"2D game code was included in the initial application imports.",
		);
	}
	const gzipSize = (file: string): number =>
		gzipSync(readFileSync(path.join(distRoot, file))).byteLength;
	const graphGzipSize = (
		entryKey: string,
		excluded = new Set<string>(),
	): { bytes: number; keys: Set<string> } => {
		const keys = new Set<string>();
		const visit = (key: string): number => {
			if (keys.has(key) || excluded.has(key)) return 0;
			const entry = manifest[key];
			if (!entry) throw new Error(`Manifest import '${key}' does not exist.`);
			keys.add(key);
			return (
				gzipSize(entry.file) +
				(entry.imports ?? []).reduce((total, importedKey) => {
					return total + visit(importedKey);
				}, 0)
			);
		};
		return { bytes: visit(entryKey), keys };
	};
	const applicationGraph = graphGzipSize("index.html");
	const gameRouteGraph = graphGzipSize(gameRouteKey, applicationGraph.keys);
	const phaserGraph = graphGzipSize(
		phaserKey,
		new Set([...applicationGraph.keys, ...gameRouteGraph.keys]),
	);
	const applicationGzipBytes = applicationGraph.bytes;
	const gameRouteGzipBytes = gameRouteGraph.bytes;
	const phaserGzipBytes = phaserGraph.bytes;
	if (applicationGzipBytes > RPG_BUNDLE_BUDGETS.applicationGzipBytes) {
		throw new Error(
			`Application bundle ${applicationGzipBytes} exceeds ${RPG_BUNDLE_BUDGETS.applicationGzipBytes} gzip bytes.`,
		);
	}
	if (gameRouteGzipBytes > RPG_BUNDLE_BUDGETS.gameRouteGzipBytes) {
		throw new Error(
			`2D game route bundle ${gameRouteGzipBytes} exceeds ${RPG_BUNDLE_BUDGETS.gameRouteGzipBytes} gzip bytes.`,
		);
	}
	if (phaserGzipBytes > RPG_BUNDLE_BUDGETS.phaserGzipBytes) {
		throw new Error(
			`Phaser bundle ${phaserGzipBytes} exceeds ${RPG_BUNDLE_BUDGETS.phaserGzipBytes} gzip bytes.`,
		);
	}
	return {
		applicationGzipBytes,
		gameRouteGzipBytes,
		phaserGzipBytes,
		applicationFile: application.file,
		gameRouteFile: gameRoute.file,
		phaserFile: phaser.file,
	};
}

if (import.meta.main) {
	console.log(JSON.stringify({ ok: true, ...validateRpgBundle() }));
}
