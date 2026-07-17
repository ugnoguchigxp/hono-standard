import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function filesUnder(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const current = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesUnder(current)));
		else files.push(current);
	}
	return files;
}

const sourceFiles = await filesUnder(
	path.resolve(process.cwd(), "web/src/domains/dashboard"),
);
for (const file of sourceFiles) {
	const source = await readFile(file, "utf8");
	if (source.includes("dangerouslySetInnerHTML"))
		throw new Error(
			`Dashboard security gate: unsafe HTML rendering in ${file}`,
		);
}

const distRoot = path.resolve(process.cwd(), "dist-web/assets");
const assets = await filesUnder(distRoot);
const sources = await Promise.all(
	assets
		.filter((file) => file.endsWith(".js"))
		.map((file) => readFile(file, "utf8")),
);
const forbiddenMarkers = ["hono-standard-e2e-jwt-secret", "password123456"];
for (const marker of forbiddenMarkers)
	if (sources.some((source) => source.includes(marker)))
		throw new Error(
			`Dashboard security gate: test marker leaked into production assets: ${marker}`,
		);
console.log(
	`Dashboard security gate passed: ${sources.length} production JS assets scanned`,
);
