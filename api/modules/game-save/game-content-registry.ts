import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
	ACTION3D_CONTENT_VERSION,
	type Action3dContentRegistry,
	parseAction3dBundle,
	parseAction3dManifest,
	type RawAction3dDocument,
} from "../../../shared/action3d";
import {
	GAME_CONTENT_VERSION,
	type GameContentRegistry,
	parseContentManifest,
	parseGameContentBundle,
	type RawContentDocument,
} from "../../../shared/game";

const readJson = (filePath: string): unknown =>
	JSON.parse(readFileSync(filePath, "utf8"));

const findPublicRoot = (
	projectRoot: string,
	contentVersion: string,
): string => {
	const candidates = [
		path.join(projectRoot, "dist-web"),
		path.join(projectRoot, "web", "public"),
	];
	const publicRoot = candidates.find((candidate) =>
		existsSync(
			path.join(candidate, "game-content", contentVersion, "manifest.json"),
		),
	);
	if (!publicRoot) {
		throw new Error(`Game content '${contentVersion}' is unavailable.`);
	}
	return publicRoot;
};

export function loadServerGameContentRegistry(
	projectRoot = process.cwd(),
	contentVersion = GAME_CONTENT_VERSION,
): GameContentRegistry {
	const publicRoot = findPublicRoot(projectRoot, contentVersion);
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

export function loadServerAction3dContentRegistry(
	projectRoot = process.cwd(),
	contentVersion = ACTION3D_CONTENT_VERSION,
): Action3dContentRegistry {
	const candidates = [
		path.join(projectRoot, "dist-web"),
		path.join(projectRoot, "web", "public"),
	];
	const publicRoot = candidates.find((candidate) =>
		existsSync(
			path.join(candidate, "action3d-content", contentVersion, "manifest.json"),
		),
	);
	if (!publicRoot)
		throw new Error(`Action3D content '${contentVersion}' is unavailable.`);
	const contentRoot = path.join(publicRoot, "action3d-content", contentVersion);
	const manifestPath = path.join(contentRoot, "manifest.json");
	const manifestRaw = readJson(manifestPath);
	const manifest = parseAction3dManifest(manifestRaw, manifestPath);
	const worlds: RawAction3dDocument[] = manifest.documents.worlds.map(
		(document) => ({
			path: document.path,
			data: readJson(path.join(contentRoot, document.path)),
		}),
	);
	return parseAction3dBundle({ manifestPath, manifest: manifestRaw, worlds });
}
