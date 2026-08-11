import { access, readFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_BLENDER = { major: 5, minor: 2 } as const;

export type Action3dDccPreflight = {
	bin: string;
	version: string;
	preset: string;
	sources: string[];
};

const run = async (command: string[]) => {
	const process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);
	if (exitCode !== 0)
		throw new Error(
			`${command[0]} failed (${exitCode}): ${(stderr || stdout).trim()}`,
		);
	return stdout;
};

export async function preflightAction3dDcc(
	projectRoot = process.cwd(),
): Promise<Action3dDccPreflight> {
	const bin = process.env.ACTION3D_BLENDER_BIN || "blender";
	let versionOutput: string;
	try {
		versionOutput = await run([bin, "--version"]);
	} catch (error) {
		throw new Error(
			`Blender ${REQUIRED_BLENDER.major}.${REQUIRED_BLENDER.minor} LTS is required. Install Blender or set ACTION3D_BLENDER_BIN. ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	const match = /^Blender (\d+)\.(\d+)\.([0-9]+)/m.exec(versionOutput);
	if (!match) throw new Error("Could not parse the Blender version.");
	const [, major, minor] = match.map(Number);
	if (major !== REQUIRED_BLENDER.major || minor !== REQUIRED_BLENDER.minor)
		throw new Error(
			`Blender ${REQUIRED_BLENDER.major}.${REQUIRED_BLENDER.minor}.x is required; found ${match[0]}.`,
		);
	const sources = ["build_aether_runner.py", "build_aether_sentinel.py"].map(
		(file) => path.join(projectRoot, "art/action3d/blender", file),
	);
	const preset = path.join(
		projectRoot,
		"art/action3d/shared/export-presets/gltf-2.0.json",
	);
	await Promise.all([
		...sources.map((source) => access(source)),
		access(preset),
	]);
	const presetData = JSON.parse(await readFile(preset, "utf8")) as {
		dccVersion?: string;
		format?: string;
	};
	if (presetData.dccVersion !== "5.2 LTS" || presetData.format !== "GLB")
		throw new Error(
			"Action3D glTF export preset is not the reviewed 5.2 LTS GLB preset.",
		);
	return { bin, version: match[0], preset, sources };
}

if (import.meta.main) {
	try {
		const result = await preflightAction3dDcc();
		console.log(
			`OK Action3D DCC preflight: ${result.version}, ${path.relative(process.cwd(), result.preset)}`,
		);
	} catch (error) {
		console.error("FAIL Action3D DCC preflight");
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
