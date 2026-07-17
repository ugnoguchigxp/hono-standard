import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const targets = [
	"main",
	"overlay/ssg",
	"overlay/ssr",
	"variant/sqlite",
	"variant/postgres",
	"variant/pgvector",
	"variant/rag",
	"variant/turso",
	"variant/cloudflare",
];
const dirty =
	execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
		.length > 0;
const progress = readFileSync("docs/dashboard-overlay/progress.md", "utf8");
const cartesianExpansionComplete = /\| V12 \|[^|]+\| complete \|/.test(
	progress,
);
const available = new Set(
	execFileSync(
		"git",
		["for-each-ref", "--format=%(refname:short)", "refs/heads"],
		{ encoding: "utf8" },
	)
		.split("\n")
		.filter(Boolean),
);
const result = targets.map((target) => ({
	target,
	branch: available.has(target),
	result: !cartesianExpansionComplete
		? "blocked_by_pending_cartesian_expansion"
		: dirty
			? "blocked_by_uncommitted_candidate"
			: "not_run",
}));
console.log(
	JSON.stringify(
		{
			candidate: dirty ? "uncommitted" : "clean",
			prerequisite: cartesianExpansionComplete
				? "05_v12_complete"
				: "05_v12_pending",
			result,
		},
		null,
		2,
	),
);
if (dirty || !cartesianExpansionComplete) process.exitCode = 2;
