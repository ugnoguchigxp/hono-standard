import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export function extractMarkdownTargets(source: string) {
	return [
		...source.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g),
	].flatMap((match) => (match[1] ? [match[1]] : []));
}

async function markdownFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const current = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await markdownFiles(current)));
		else if (entry.isFile() && entry.name.endsWith(".md")) files.push(current);
	}
	return files;
}

export async function findBrokenDashboardDocLinks(root = process.cwd()) {
	const candidates = [
		path.join(root, "README.md"),
		path.join(root, "LLM_CONTEXT.md"),
		path.join(root, "docs/template-variant-management.md"),
		...(await markdownFiles(path.join(root, "docs/dashboard-overlay"))),
	];
	const broken: Array<{ file: string; target: string }> = [];
	for (const file of candidates) {
		const source = await Bun.file(file).text();
		for (const rawTarget of extractMarkdownTargets(source)) {
			const target = rawTarget.replace(/^<|>$/g, "");
			if (/^(?:https?:|mailto:|#|app:)/.test(target)) continue;
			const localTarget = target.split("#", 1)[0];
			if (!localTarget) continue;
			try {
				await stat(path.resolve(path.dirname(file), localTarget));
			} catch {
				broken.push({ file: path.relative(root, file), target });
			}
		}
	}
	return broken;
}

if (import.meta.main) {
	const broken = await findBrokenDashboardDocLinks();
	if (broken.length > 0) {
		console.error(JSON.stringify({ broken }, null, 2));
		process.exit(1);
	}
	console.log("Dashboard documentation link gate passed");
}
