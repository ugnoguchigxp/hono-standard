import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	ACTION3D_CONTENT_VERSION,
	type Action3dAsset,
	parseAction3dManifest,
} from "../shared/action3d";
import { preflightAction3dDcc } from "./action3d/preflight-dcc";
import { validateAction3dModel } from "./validate-action3d-models";

const run = async (command: string[]) => {
	const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
	const exitCode = await child.exited;
	if (exitCode !== 0)
		throw new Error(`${command.join(" ")} failed with exit code ${exitCode}.`);
};
const manifestPath = path.join(
	process.cwd(),
	"web/public/action3d-content",
	ACTION3D_CONTENT_VERSION,
	"manifest.json",
);
const exports = [
	{
		id: "aether-runner",
		script: "art/action3d/blender/build_aether_runner.py",
		glb: "web/public/assets/action3d/characters/aether-runner.glb",
		blend: "art/action3d/player/aether-runner.blend",
	},
	{
		id: "aether-sentinel",
		script: "art/action3d/blender/build_aether_sentinel.py",
		glb: "web/public/assets/action3d/enemies/aether-sentinel.glb",
		blend: "art/action3d/enemies/aether-sentinel.blend",
	},
].map((value) => ({
	...value,
	script: path.join(process.cwd(), value.script),
	glb: path.join(process.cwd(), value.glb),
	blend: path.join(process.cwd(), value.blend),
}));

const readModelAsset = async (assetId: string) => {
	const raw = JSON.parse(await readFile(manifestPath, "utf8"));
	const manifest = parseAction3dManifest(raw, manifestPath);
	const asset = manifest.assets.find(
		(value): value is Extract<Action3dAsset, { type: "model" }> =>
			value.id === assetId && value.type === "model",
	);
	if (!asset) throw new Error(`The ${assetId} model contract is missing.`);
	return { raw, asset };
};

const syncIdentity = async (assetId: string, glb: string) => {
	const { raw, asset } = await readModelAsset(assetId);
	const bytes = await readFile(glb);
	const identity = {
		bytes: bytes.byteLength,
		sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
	};
	const mutable = raw as {
		assets: Array<{ id: string; bytes: number; sha256: string }>;
	};
	const target = mutable.assets.find((value) => value.id === asset.id);
	if (!target) throw new Error(`The ${assetId} manifest entry disappeared.`);
	Object.assign(target, identity);
	await writeFile(manifestPath, `${JSON.stringify(raw, null, "\t")}\n`);
	return identity;
};

const main = async () => {
	const preflight = await preflightAction3dDcc();
	const check = process.argv.includes("--check");
	const temporary = check
		? await mkdtemp(path.join(tmpdir(), "action3d-export-check-"))
		: null;
	try {
		for (const target of exports) {
			const blend = temporary
				? path.join(temporary, `${target.id}.blend`)
				: target.blend;
			const glb = temporary
				? path.join(temporary, `${target.id}.glb`)
				: target.glb;
			await run([
				preflight.bin,
				"--background",
				"--factory-startup",
				"--python-exit-code",
				"1",
				"--python",
				target.script,
				"--",
				"--blend",
				blend,
				"--glb",
				glb,
			]);
			if (!check) await syncIdentity(target.id, glb);
			const { asset } = await readModelAsset(target.id);
			const result = validateAction3dModel(
				asset,
				await readFile(glb),
				glb,
				!check,
			);
			if (result.issues.length > 0)
				throw new Error(
					`${target.id}:\n${result.issues.map((issue) => `- ${issue}`).join("\n")}`,
				);
			console.log(
				`OK ${target.id} ${check ? "reproducibility check" : "asset export"}: ${result.report.triangles} triangles, ${result.report.clips.length} clips, ${result.bytes} bytes`,
			);
		}
		if (!check) await run(["bunx", "biome", "format", "--write", manifestPath]);
	} finally {
		if (temporary) await rm(temporary, { recursive: true, force: true });
	}
};

try {
	await main();
} catch (error) {
	console.error("FAIL Action3D asset export");
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
