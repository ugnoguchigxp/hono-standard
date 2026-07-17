import { spawn } from "node:child_process";

export const dashboardReleaseSteps = [
	["verify", ["run", "verify"]],
	["dashboard-contract", ["run", "verify:dashboard-contract"]],
	["dashboard-adapter-sqlite", ["run", "verify:dashboard-adapter-sqlite"]],
	["dashboard-coverage", ["run", "verify:dashboard-coverage"]],
	[
		"dashboard-frontend-coverage",
		["run", "verify:dashboard-frontend-coverage"],
	],
	["dashboard-gallery", ["run", "verify:dashboard-gallery"]],
	["dashboard-bundle", ["run", "verify:dashboard-bundle"]],
	["dashboard-e2e", ["run", "verify:dashboard-e2e"]],
	["dashboard-visual", ["run", "verify:dashboard-visual"]],
	["dashboard-a11y", ["run", "verify:dashboard-a11y"]],
	["dashboard-performance", ["run", "verify:dashboard-performance"]],
	["dashboard-security", ["run", "verify:dashboard-security"]],
	["dashboard-doc-links", ["run", "verify:dashboard-doc-links"]],
	["diff-check", ["exec", "git diff --check"]],
] as const;

export function runDashboardReleaseStep(
	label: string,
	args: readonly string[],
) {
	return new Promise<number>((resolve, reject) => {
		console.log(`\n==> ${label}: bun ${args.join(" ")}`);
		const child = spawn(
			args[0] === "exec" ? args.slice(1).join(" ") : "bun",
			args[0] === "exec" ? [] : args,
			{
				stdio: "inherit",
				shell: args[0] === "exec",
				env: process.env,
			},
		);
		child.on("error", reject);
		child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
	});
}

export async function runDashboardRelease() {
	for (const [label, args] of dashboardReleaseSteps) {
		const code = await runDashboardReleaseStep(label, args);
		if (code !== 0) {
			console.error(
				`Dashboard release gate stopped at ${label} (exit ${code})`,
			);
			return code;
		}
	}
	console.log("Dashboard release gate passed");
	return 0;
}

if (import.meta.main) {
	process.exit(await runDashboardRelease());
}
