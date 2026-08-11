import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	ACTION3D_CONTENT_VERSION,
	type Action3dAsset,
	parseAction3dManifest,
} from "../shared/action3d";
import {
	type Action3dGlbReport,
	parseAction3dGlb,
} from "./action3d/glb-inspector";

export type Action3dModelValidation = {
	assetId: string;
	file: string;
	bytes: number;
	sha256: string;
	report: Action3dGlbReport;
	issues: string[];
};

const unique = (values: readonly string[], label: string, issues: string[]) => {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) issues.push(`${label} contains duplicate '${value}'.`);
		seen.add(value);
	}
};

export const validateAction3dModel = (
	asset: Extract<Action3dAsset, { type: "model" }>,
	bytes: Uint8Array,
	file = asset.url,
	checkIdentity = true,
): Action3dModelValidation => {
	const report = parseAction3dGlb(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
	);
	const sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
	const issues: string[] = [];
	if (checkIdentity && bytes.byteLength !== asset.bytes)
		issues.push(
			`declares ${asset.bytes} bytes but file has ${bytes.byteLength}.`,
		);
	if (checkIdentity && sha256 !== asset.sha256)
		issues.push(`declares ${asset.sha256} but file has ${sha256}.`);
	if (!report.nodes.includes(asset.model.rootNode))
		issues.push(`root node '${asset.model.rootNode}' is missing.`);
	if (
		asset.model.skeletonRoot &&
		!report.nodes.includes(asset.model.skeletonRoot)
	)
		issues.push(`skeleton root '${asset.model.skeletonRoot}' is missing.`);
	if (asset.model.skeletonRoot && report.skeletons.length === 0)
		issues.push("declares a skeleton root but the GLB has no skin.");
	const skeletonBoneCount = Math.max(
		0,
		...report.skeletons.map((skin) => skin.bones),
	);
	for (const meshNode of asset.model.meshNodes)
		if (!report.meshNodes.includes(meshNode))
			issues.push(`mesh node '${meshNode}' is missing.`);
	for (const clip of asset.model.clips) {
		const actual = report.clips.find(
			(candidate) => candidate.name === clip.name,
		);
		if (!actual) {
			issues.push(`clip '${clip.name}' (${clip.id}) is missing.`);
			continue;
		}
		if (
			actual.durationMs < clip.durationMs.min ||
			actual.durationMs > clip.durationMs.max
		)
			issues.push(
				`clip '${clip.name}' duration ${actual.durationMs} ms is outside ${clip.durationMs.min}-${clip.durationMs.max} ms.`,
			);
		if (
			asset.model.skeletonRoot &&
			(actual.rotationBones < skeletonBoneCount ||
				actual.translationBones < skeletonBoneCount)
		)
			issues.push(
				`clip '${clip.name}' resets ${actual.rotationBones}/${skeletonBoneCount} bone rotations and ${actual.translationBones}/${skeletonBoneCount} bone translations; every clip must own the complete pose.`,
			);
	}
	for (const socket of asset.model.sockets)
		if (!report.nodes.includes(socket.node))
			issues.push(`socket node '${socket.node}' (${socket.id}) is missing.`);
	for (const material of asset.model.materials)
		if (!report.materials.includes(material.name))
			issues.push(`material '${material.name}' (${material.id}) is missing.`);
	unique(report.nodes, "GLB nodes", issues);
	unique(
		report.clips.map((clip) => clip.name),
		"GLB clips",
		issues,
	);
	unique(report.materials, "GLB materials", issues);

	const budget = asset.model.budget;
	for (const [label, actual, maximum] of [
		["transfer bytes", bytes.byteLength, budget.maxTransferBytes],
		["triangles", report.triangles, budget.maxTriangles],
		["primitives", report.primitives, budget.maxPrimitives],
		["materials", report.materials.length, budget.maxMaterials],
		["textures", report.textures, budget.maxTextures],
		["texture size", report.maxTextureSize, budget.maxTextureSize],
		["bones", skeletonBoneCount, budget.maxBones],
		["bone influences", report.maxBoneInfluences, budget.maxBoneInfluences],
	] as const)
		if (actual > maximum)
			issues.push(`${label} ${actual} exceeds budget ${maximum}.`);

	if (!report.bounds) issues.push("mesh bounds could not be calculated.");
	else {
		const expected = asset.model.transform.boundsMeters;
		for (const [axis, actual, declared] of [
			["width", report.bounds.width, expected.width],
			["height", report.bounds.height, expected.height],
			["depth", report.bounds.depth, expected.depth],
		] as const) {
			const tolerance = Math.max(0.05, declared * 0.08);
			if (Math.abs(actual - declared) > tolerance)
				issues.push(
					`${axis} ${actual.toFixed(3)} m differs from declared ${declared.toFixed(3)} m.`,
				);
		}
		const groundY = report.bounds.min[1] + asset.model.transform.groundOffset;
		if (Math.abs(groundY) > 0.05)
			issues.push(
				`ground offset resolves to ${groundY.toFixed(3)} m instead of 0.`,
			);
	}
	return {
		assetId: asset.id,
		file,
		bytes: bytes.byteLength,
		sha256,
		report,
		issues,
	};
};

const argumentValue = (name: string) => {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
};

export async function validateAction3dModels(projectRoot = process.cwd()) {
	const manifestPath = path.join(
		projectRoot,
		"web",
		"public",
		"action3d-content",
		ACTION3D_CONTENT_VERSION,
		"manifest.json",
	);
	const manifest = parseAction3dManifest(
		JSON.parse(await readFile(manifestPath, "utf8")),
		manifestPath,
	);
	const onlyAsset = argumentValue("--asset");
	const models = manifest.assets.filter(
		(asset): asset is Extract<Action3dAsset, { type: "model" }> =>
			asset.type === "model" && (!onlyAsset || asset.id === onlyAsset),
	);
	if (onlyAsset && models.length === 0)
		throw new Error(`Unknown Action3D model asset '${onlyAsset}'.`);
	const results: Action3dModelValidation[] = [];
	for (const asset of models) {
		const filePath = path.join(
			projectRoot,
			"web",
			"public",
			asset.url.slice(1),
		);
		const bytes = await readFile(filePath);
		results.push(validateAction3dModel(asset, bytes, filePath));
	}
	const reportPath = argumentValue("--report");
	if (reportPath) {
		const absolute = path.resolve(projectRoot, reportPath);
		await mkdir(path.dirname(absolute), { recursive: true });
		await writeFile(
			absolute,
			`${JSON.stringify(
				results.map(({ assetId, file, bytes, sha256, report }) => ({
					assetId,
					file: path.relative(projectRoot, file),
					bytes,
					sha256,
					...report,
				})),
				null,
				2,
			)}\n`,
		);
	}
	return results;
}

if (import.meta.main) {
	try {
		const results = await validateAction3dModels();
		const failed = results.filter((result) => result.issues.length > 0);
		for (const result of results) {
			const summary = `${result.assetId}: ${result.report.triangles} triangles, ${result.report.skeletons.reduce((total, skin) => Math.max(total, skin.bones), 0)} bones, ${result.report.clips.length} clips, ${result.bytes} bytes`;
			if (result.issues.length === 0) console.log(`OK ${summary}`);
			else {
				console.error(`FAIL ${summary}`);
				for (const issue of result.issues) console.error(`  - ${issue}`);
			}
		}
		if (failed.length > 0) process.exit(1);
	} catch (error) {
		console.error("FAIL Action3D model validation");
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
