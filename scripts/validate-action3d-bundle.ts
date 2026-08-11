import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type Budget = { pattern: RegExp; rawBytes: number; gzipBytes: number };
const budgets: Budget[] = [
	{ pattern: /^Action3dView-.*\.js$/, rawBytes: 45_000, gzipBytes: 15_000 },
	{ pattern: /^Action3dGame-.*\.js$/, rawBytes: 500_000, gzipBytes: 135_000 },
];

export function validateAction3dBundle(projectRoot = process.cwd()) {
	const assetsRoot = path.join(projectRoot, "dist-web", "assets");
	const files = readdirSync(assetsRoot);
	const results = budgets.map((budget) => {
		const matches = files.filter((file) => budget.pattern.test(file));
		if (matches.length !== 1)
			throw new Error(
				`Expected one Action3D bundle matching ${budget.pattern}, found ${matches.length}.`,
			);
		const file = matches[0];
		const bytes = readFileSync(path.join(assetsRoot, file));
		const gzipBytes = gzipSync(bytes).byteLength;
		if (bytes.byteLength > budget.rawBytes || gzipBytes > budget.gzipBytes)
			throw new Error(
				`${file} exceeds its bundle budget: ${bytes.byteLength}/${budget.rawBytes} raw, ${gzipBytes}/${budget.gzipBytes} gzip bytes.`,
			);
		return { file, rawBytes: bytes.byteLength, gzipBytes };
	});
	return results;
}

if (import.meta.main) {
	for (const result of validateAction3dBundle())
		console.log(
			`OK ${result.file}: ${result.rawBytes} raw bytes, ${result.gzipBytes} gzip bytes`,
		);
}
