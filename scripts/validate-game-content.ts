import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
	ContentValidationError,
	GAME_CONTENT_VERSION,
	parseContentManifest,
	parseGameContentBundle,
	type GameContentRegistry,
	type RawContentDocument,
} from "../shared/game";

const readJson = (filePath: string): unknown => {
	const source = readFileSync(filePath, "utf8");
	try {
		return JSON.parse(source);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid JSON.";
		throw new Error(`${filePath}: ${message}`);
	}
};

export function validateGameContentDirectory(
	projectRoot = process.cwd(),
	contentVersion = GAME_CONTENT_VERSION,
): GameContentRegistry {
	const publicRoot = path.join(projectRoot, "web", "public");
	const contentRoot = path.join(publicRoot, "game-content", contentVersion);
	const manifestPath = path.join(contentRoot, "manifest.json");
	const manifestRaw = readJson(manifestPath);
	const manifest = parseContentManifest(manifestRaw, manifestPath);
	const loadDocuments = (paths: readonly string[]): RawContentDocument[] =>
		paths.map((documentPath) => ({
			path: documentPath,
			data: readJson(path.join(contentRoot, documentPath)),
		}));
	return parseGameContentBundle({
		manifestPath,
		manifest: manifestRaw,
		maps: loadDocuments(manifest.documents.maps),
		events: loadDocuments(manifest.documents.events),
		assetExists: (url) => existsSync(path.join(publicRoot, url.slice(1))),
	});
}

if (import.meta.main) {
	try {
		const registry = validateGameContentDirectory();
		console.log(
			`OK game content ${registry.contentVersion}: ${Object.keys(registry.mapsById).length} maps, ${Object.keys(registry.eventsById).length} events, ${registry.assets.length} assets`,
		);
	} catch (error) {
		console.error("FAIL game content validation");
		if (error instanceof ContentValidationError) {
			for (const issue of error.issues) {
				console.error(
					`${issue.documentPath} ${issue.dataPath} [${issue.code}] ${issue.message}`,
				);
			}
		} else {
			console.error(error instanceof Error ? error.message : String(error));
		}
		process.exit(1);
	}
}
