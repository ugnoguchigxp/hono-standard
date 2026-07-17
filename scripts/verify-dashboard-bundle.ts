import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = path.resolve(process.cwd(), "dist-web");
const budget = JSON.parse(
	await fs.readFile(
		path.resolve(process.cwd(), "scripts/dashboard-bundle-budget.json"),
		"utf8",
	),
) as {
	initial: { rawBytes: number; gzipBytes: number };
	dashboardShell: { rawBytes: number; gzipBytes: number };
	kpiRenderers: Record<string, { rawBytes: number; gzipBytes: number }>;
	stateRenderers: Record<string, { rawBytes: number; gzipBytes: number }>;
	specializedRenderers: Record<string, { rawBytes: number; gzipBytes: number }>;
	nonCartesianRenderers: Record<
		string,
		{ rawBytes: number; gzipBytes: number }
	>;
};
const forbidden = [
	"recharts",
	"react-grid-layout",
	"ResponsiveContainer",
	"LineChart",
];
const read = async (file: string) => fs.readFile(path.join(root, file), "utf8");
const manifestPath = path.join(root, ".vite", "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Record<
	string,
	{
		file: string;
		isEntry?: boolean;
		imports?: string[];
		dynamicImports?: string[];
	}
>;
const entryByKey = (key: string) => manifest[key];
const entryByFile = (file: string) =>
	Object.values(manifest).find((item) => item.file === file);
const graph = (start: string) => {
	const files = new Set<string>();
	const visit = (key: string) => {
		const item = entryByKey(key) ?? entryByFile(key);
		if (!item || files.has(item.file)) return;
		files.add(item.file);
		for (const imported of item.imports ?? []) {
			// Vite records the HTML entry as a shared dependency marker; it is not a JS edge.
			if (imported === "index.html") continue;
			visit(imported);
		}
	};
	visit(start);
	return files;
};
const graphBytes = async (files: Set<string>) => {
	const sources = await Promise.all([...files].map(read));
	const rawBytes = sources.reduce(
		(total, source) => total + Buffer.byteLength(source),
		0,
	);
	const gzipBytes = gzipSync(sources.join("\n")).byteLength;
	return { rawBytes, gzipBytes };
};
const assertBudget = (
	name: string,
	actual: { rawBytes: number; gzipBytes: number },
	expected: { rawBytes: number; gzipBytes: number },
) => {
	if (
		actual.rawBytes > expected.rawBytes ||
		actual.gzipBytes > expected.gzipBytes
	)
		throw new Error(
			`Dashboard bundle gate: ${name} budget exceeded: ${JSON.stringify({ actual, expected })}`,
		);
};
const assertGraphDoesNotContain = async (
	name: string,
	files: Set<string>,
	tokens = forbidden,
) => {
	for (const file of files) {
		const source = await read(file);
		for (const token of tokens)
			if (source.includes(token))
				throw new Error(
					`Dashboard bundle gate: ${token} leaked into ${name} graph ${file}`,
				);
	}
};

const entry = Object.values(manifest).find((item) => item.isEntry);
if (!entry) throw new Error("Dashboard bundle gate: Vite entry was not found");
const staticFiles = graph(
	Object.keys(manifest).find((key) => manifest[key] === entry) ?? entry.file,
);
await assertGraphDoesNotContain("initial", staticFiles);
const initialBytes = await graphBytes(staticFiles);
assertBudget("initial", initialBytes, budget.initial);

const dashboardKey = Object.keys(manifest).find((key) =>
	manifest[key]?.file.includes("dashboard-route.lazy"),
);
const dashboardChunk = dashboardKey ? manifest[dashboardKey] : undefined;
if (!dashboardKey || !dashboardChunk)
	throw new Error(
		"Dashboard bundle gate: lazy dashboard chunk was not emitted",
	);
const dashboardFiles = graph(dashboardKey);
// The app entry is the parent of the lazy route, not part of the dashboard shell.
dashboardFiles.delete(entry.file);
const dashboardSources = await Promise.all([...dashboardFiles].map(read));
if (!dashboardSources.some((source) => source.includes("react-grid-layout")))
	throw new Error(
		"Dashboard bundle gate: dashboard graph does not contain grid code",
	);

const rendererKeys = [
	"src/domains/dashboard/v2/visualizations/core-timeseries/renderer.lazy.tsx",
	"src/domains/dashboard/v2/visualizations/core-bar/renderer.lazy.tsx",
	"src/domains/dashboard/v2/visualizations/core-composed/renderer.lazy.tsx",
	"src/domains/dashboard/v2/visualizations/core-stat/renderer.lazy.tsx",
	"src/domains/dashboard/v2/visualizations/core-table/renderer.lazy.tsx",
];
const kpiRendererKeys = [
	"core-stat",
	"core-gauge",
	"core-bar-gauge",
	"core-bullet",
	"core-progress",
	"core-traffic-light",
].map(
	(type) => `src/domains/dashboard/v2/visualizations/${type}/renderer.lazy.tsx`,
);
const nonCartesianRendererKeys = [
	"core-pie",
	"core-radar",
	"core-radial-bar",
	"core-scatter",
	"core-funnel",
	"core-treemap",
	"core-sunburst",
	"core-sankey",
].map(
	(type) => `src/domains/dashboard/v2/visualizations/${type}/renderer.lazy.tsx`,
);
const stateRendererKeys = [
	"core-state-timeline",
	"core-status-history",
	"core-uptime-grid",
].map(
	(type) => `src/domains/dashboard/v2/visualizations/${type}/renderer.lazy.tsx`,
);
const specializedRendererKeys = [
	"core-node-graph",
	"core-candlestick",
	"observability-logs",
	"observability-trace-waterfall",
	"observability-flame-graph",
	"geo-map",
].map(
	(type) => `src/domains/dashboard/v2/visualizations/${type}/renderer.lazy.tsx`,
);
const dashboardEntries = Object.values(manifest).filter((item) =>
	dashboardFiles.has(item.file),
);
for (const rendererKey of rendererKeys)
	if (
		!dashboardEntries.some((item) => item.dynamicImports?.includes(rendererKey))
	)
		throw new Error(
			`Dashboard bundle gate: ${rendererKey} is not a dashboard dynamic renderer`,
		);
for (const rendererKey of [...kpiRendererKeys])
	if (
		!dashboardEntries.some((item) => item.dynamicImports?.includes(rendererKey))
	)
		throw new Error(
			`Dashboard bundle gate: ${rendererKey} is not a dashboard dynamic renderer`,
		);
for (const rendererKey of nonCartesianRendererKeys)
	if (
		!dashboardEntries.some((item) => item.dynamicImports?.includes(rendererKey))
	)
		throw new Error(
			`Dashboard bundle gate: ${rendererKey} is not a dashboard dynamic renderer`,
		);

for (const rendererKey of stateRendererKeys) {
	if (!entryByKey(rendererKey))
		throw new Error(`Dashboard bundle gate: ${rendererKey} missing`);
	if (
		!dashboardEntries.some((item) => item.dynamicImports?.includes(rendererKey))
	)
		throw new Error(
			`Dashboard bundle gate: ${rendererKey} is not a dashboard dynamic renderer`,
		);
	const type = rendererKey.split("/").at(-2) ?? rendererKey;
	const actual = await graphBytes(graph(rendererKey));
	const expected = budget.stateRenderers[type];
	if (!expected)
		throw new Error(
			`Dashboard bundle gate: state budget row missing for ${type}`,
		);
	await assertGraphDoesNotContain(
		`state ${type}`,
		graph(rendererKey),
		forbidden.filter((token) => token !== "react-grid-layout"),
	);
	assertBudget(`state ${type}`, actual, expected);
}
for (const rendererKey of specializedRendererKeys) {
	if (!entryByKey(rendererKey))
		throw new Error(`Dashboard bundle gate: ${rendererKey} missing`);
	if (
		!dashboardEntries.some((item) => item.dynamicImports?.includes(rendererKey))
	)
		throw new Error(
			`Dashboard bundle gate: ${rendererKey} is not a dashboard dynamic renderer`,
		);
	const type = rendererKey.split("/").at(-2) ?? rendererKey;
	const actual = await graphBytes(graph(rendererKey));
	const expected = budget.specializedRenderers[type];
	if (!expected)
		throw new Error(
			`Dashboard bundle gate: specialized budget row missing for ${type}`,
		);
	await assertGraphDoesNotContain(
		`specialized ${type}`,
		graph(rendererKey),
		forbidden.filter((token) => token !== "react-grid-layout"),
	);
	assertBudget(`specialized ${type}`, actual, expected);
}
const cartesianGraphs = rendererKeys.slice(0, 3).map((rendererKey) => {
	if (!entryByKey(rendererKey))
		throw new Error(`Dashboard bundle gate: ${rendererKey} missing`);
	return graph(rendererKey);
});
const sharedCartesianFiles = [...(cartesianGraphs[0] ?? [])].filter((file) =>
	cartesianGraphs.slice(1).every((files) => files.has(file)),
);
const sharedCartesianSources = await Promise.all(
	sharedCartesianFiles.map(read),
);
if (
	!sharedCartesianSources.some(
		(source) =>
			source.includes("ResponsiveContainer") || source.includes("recharts"),
	)
)
	throw new Error(
		"Dashboard bundle gate: Cartesian renderers do not share the chart dependency graph",
	);
for (const rendererKey of rendererKeys.slice(3)) {
	if (!entryByKey(rendererKey))
		throw new Error(`Dashboard bundle gate: ${rendererKey} missing`);
	await assertGraphDoesNotContain(
		rendererKey,
		graph(rendererKey),
		forbidden.filter((token) => token !== "react-grid-layout"),
	);
}
for (const [type, rendererKey] of kpiRendererKeys.map((key) => [
	key.split("/").at(-2)?.replace("core-", "core-") ?? key,
	key,
])) {
	if (!entryByKey(rendererKey))
		throw new Error(`Dashboard bundle gate: ${rendererKey} missing`);
	const actual = await graphBytes(graph(rendererKey));
	const expected = budget.kpiRenderers[type];
	if (!expected)
		throw new Error(
			`Dashboard bundle gate: KPI budget row missing for ${type}`,
		);
	await assertGraphDoesNotContain(
		`KPI ${type}`,
		graph(rendererKey),
		forbidden.filter((token) => token !== "react-grid-layout"),
	);
	assertBudget(`KPI ${type}`, actual, expected);
}
for (const rendererKey of nonCartesianRendererKeys) {
	const type =
		rendererKey.split("/").at(-2)?.replace("core-", "core-") ?? rendererKey;
	const entry = entryByKey(rendererKey);
	if (!entry) throw new Error(`Dashboard bundle gate: ${rendererKey} missing`);
	const actual = await graphBytes(graph(rendererKey));
	const expected = budget.nonCartesianRenderers[type];
	if (!expected)
		throw new Error(
			`Dashboard bundle gate: non-Cartesian budget row missing for ${type}`,
		);
	// Renderer graphs include the shared catalog chunk, so dependency-token
	// checks here would report unrelated shell dependencies as renderer leaks.
	assertBudget(`non-Cartesian ${type}`, actual, expected);
}
const catalog = await fs.readFile(
	path.resolve(
		process.cwd(),
		"web/src/domains/dashboard/v2/visualizations/catalog.ts",
	),
	"utf8",
);
if (catalog.includes("renderer.lazy"))
	throw new Error(
		"Dashboard bundle gate: visualization catalog statically imports a renderer",
	);
await assertGraphDoesNotContain(
	"dashboard shell",
	dashboardFiles,
	forbidden.filter((token) => token !== "react-grid-layout"),
);
const dashboardBytes = await graphBytes(dashboardFiles);
assertBudget("dashboard shell", dashboardBytes, budget.dashboardShell);
console.log(
	`Dashboard bundle gate passed: initial=${JSON.stringify(initialBytes)} shell=${JSON.stringify(dashboardBytes)} lazy=${dashboardChunk.file}`,
);
