import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
	ACTION3D_CONTENT_VERSION,
	Action3dContentError,
	parseAction3dBundle,
	parseAction3dManifest,
	type RawAction3dDocument,
} from "../shared/action3d";

const readJson = (filePath: string): unknown => {
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch (error) {
		throw new Error(
			`${filePath}: ${error instanceof Error ? error.message : "Invalid JSON."}`,
		);
	}
};
export function validateAction3dContentDirectory(
	projectRoot = process.cwd(),
	contentVersion = ACTION3D_CONTENT_VERSION,
) {
	const publicRoot = path.join(projectRoot, "web", "public");
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
	return parseAction3dBundle({
		manifestPath,
		manifest: manifestRaw,
		worlds,
		assetExists: (url) => existsSync(path.join(publicRoot, url.slice(1))),
		assetSize: (url) => {
			const assetPath = path.join(publicRoot, url.slice(1));
			return existsSync(assetPath) ? statSync(assetPath).size : undefined;
		},
		assetHash: (url) => {
			const assetPath = path.join(publicRoot, url.slice(1));
			return existsSync(assetPath)
				? `sha256:${createHash("sha256").update(readFileSync(assetPath)).digest("hex")}`
				: undefined;
		},
	});
}
if (import.meta.main) {
	try {
		const registry = validateAction3dContentDirectory();
		console.log(
			`OK Action3D content ${registry.contentVersion}: ${Object.keys(registry.worldsById).length} world(s), ${Object.keys(registry.assetsById).length} asset(s)`,
		);
	} catch (error) {
		console.error("FAIL Action3D content validation");
		if (error instanceof Action3dContentError)
			for (const issue of error.issues)
				console.error(
					`${issue.documentPath} ${issue.dataPath} [${issue.code}] ${issue.message}`,
				);
		else console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
