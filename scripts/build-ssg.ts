import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SSR_OUTLET = "<!--ssr-outlet-->";
const PUBLIC_ROUTES = ["/", "/showcase", "/login"] as const;

type RenderModule = {
	render(url: string): Promise<{ html: string }>;
};

export function injectSsrHtml(template: string, renderedHtml: string): string {
	if (!template.includes(SSR_OUTLET)) {
		throw new Error(`Client HTML template is missing ${SSR_OUTLET}.`);
	}
	return template.replace(SSR_OUTLET, renderedHtml);
}

export function routeOutputPath(outputRoot: string, route: string): string {
	if (route === "/") return path.join(outputRoot, "index.html");
	const routePath = route.replace(/^\/+|\/+$/g, "");
	if (!routePath || routePath.includes("..")) {
		throw new Error(`Invalid static route: ${route}`);
	}
	return path.join(outputRoot, routePath, "index.html");
}

export function publicRoutesForPackage(packageName: string): readonly string[] {
	return packageName.endsWith("-authless") ? ["/"] : PUBLIC_ROUTES;
}

export async function buildStaticSite(
	routes: readonly string[] = PUBLIC_ROUTES,
): Promise<string[]> {
	const repositoryRoot = process.cwd();
	const clientRoot = path.resolve(repositoryRoot, "dist-web");
	const outputRoot = path.resolve(repositoryRoot, "dist-ssg");
	const serverEntry = path.resolve(
		repositoryRoot,
		"dist-server/entry-server.js",
	);
	const template = await fs.readFile(
		path.join(clientRoot, "index.html"),
		"utf8",
	);
	const renderModule = (await import(
		`${pathToFileURL(serverEntry).href}?build=${Date.now()}`
	)) as RenderModule;

	await fs.rm(outputRoot, { recursive: true, force: true });
	await fs.cp(clientRoot, outputRoot, { recursive: true });

	const files: string[] = [];
	for (const route of routes) {
		const result = await renderModule.render(route);
		const outputPath = routeOutputPath(outputRoot, route);
		await fs.mkdir(path.dirname(outputPath), { recursive: true });
		await fs.writeFile(outputPath, injectSsrHtml(template, result.html));
		files.push(path.relative(repositoryRoot, outputPath));
	}
	return files;
}

if (import.meta.main) {
	const manifest = JSON.parse(
		await fs.readFile(path.resolve(process.cwd(), "package.json"), "utf8"),
	) as { name?: string };
	const files = await buildStaticSite(
		publicRoutesForPackage(manifest.name ?? ""),
	);
	console.log(`SSG generated ${files.length} HTML files: ${files.join(", ")}`);
}
