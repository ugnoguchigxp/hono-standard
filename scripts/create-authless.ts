import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REMOVED_PATHS = [
	"CHANGELOG.md",
	"CONTRIBUTING.md",
	"SECURITY.md",
	"api/cli/auth-create-admin.ts",
	"api/cli/auth-create-admin.test.ts",
	"api/worker.test.ts",
	"api/middleware/auth.test.ts",
	"api/middleware/auth.ts",
	"api/modules/auth",
	"api/routes/auth.route.test.ts",
	"api/routes/auth.route.ts",
	"api/routes/protected.route.test.ts",
	"api/routes/protected.route.ts",
	"drizzle/0001_auth.sql",
	"drizzle/0002_refresh_token_reuse_detection.sql",
	"docs/template-variant-management.md",
	"scripts/create-authless.test.ts",
	"scripts/create-authless.ts",
	"scripts/seed-dev.ts",
	"shared/schemas/auth.schema.ts",
	"shared/schemas/protected.schema.test.ts",
	"shared/schemas/protected.schema.ts",
	"web/src/api-coverage.test.ts",
	"web/src/api-hooks.test.ts",
	"web/src/api.test.ts",
	"web/src/api.ts",
	"web/src/auth-context.test.tsx",
	"web/src/auth-context.tsx",
	"web/src/components/dev-error-panel.test.tsx",
	"web/src/components/dev-error-panel.tsx",
	"web/src/domains/auth",
	"web/src/routes/login-route.tsx",
	"web/src/routes/login-search.ts",
	"web/src/routes/protected-route.tsx",
	"web/src/routes/route-access.test.ts",
	"web/src/routes/route-access.ts",
	"web/src/routes/showcase-route.tsx",
	"web/src/showcase-settings-context.test.tsx",
	"web/src/showcase-settings-context.tsx",
	"web/src/showcase-table-search.ts",
	"web/src/views/login-view.tsx",
	"web/src/views/protected-view.tsx",
	"web/src/views/showcase-view.test.tsx",
	"web/src/views/showcase-view.tsx",
	"web/src/web-search.test.ts",
] as const;

const REMOVED_DEPENDENCIES = [
	"@hono/zod-validator",
	"@tanstack/react-query",
	"@tanstack/react-table",
	"jose",
	"lucide-react",
	"react-hook-form",
] as const;

type CreateAuthlessOptions = {
	repositoryRoot?: string;
	updateLockfile?: boolean;
};

function repositoryFiles(repositoryRoot: string): string[] {
	const result = spawnSync(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
		{ cwd: repositoryRoot, encoding: "buffer" },
	);
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			result.stderr.toString("utf8").trim() || "git ls-files failed",
		);
	}
	return result.stdout
		.toString("utf8")
		.split("\0")
		.filter(Boolean)
		.filter((file) => fs.existsSync(path.join(repositoryRoot, file)))
		.filter((file) => !file.startsWith("templates/authless/"));
}

function copyRepositoryFile(
	repositoryRoot: string,
	targetRoot: string,
	relativePath: string,
): void {
	const source = path.join(repositoryRoot, relativePath);
	const destination = path.join(targetRoot, relativePath);
	fs.mkdirSync(path.dirname(destination), { recursive: true });
	fs.copyFileSync(source, destination);
}

function copyDirectory(source: string, destination: string): void {
	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		const sourcePath = path.join(source, entry.name);
		const destinationPath = path.join(destination, entry.name);
		if (entry.isDirectory()) {
			fs.mkdirSync(destinationPath, { recursive: true });
			copyDirectory(sourcePath, destinationPath);
		} else if (entry.isFile()) {
			fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
			fs.copyFileSync(sourcePath, destinationPath);
		}
	}
}

function updatePackageManifest(targetRoot: string): void {
	const manifestPath = path.join(targetRoot, "package.json");
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
		name: string;
		description: string;
		scripts: Record<string, string>;
		dependencies: Record<string, string>;
	};
	manifest.name = `${manifest.name}-authless`;
	manifest.description =
		"Hono + React baseline without authentication or showcase features.";
	delete manifest.scripts["auth:create-admin"];
	delete manifest.scripts["seed:dev"];
	delete manifest.scripts["template:authless"];
	for (const dependency of REMOVED_DEPENDENCIES) {
		delete manifest.dependencies[dependency];
	}
	fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
}

function refreshLockfile(targetRoot: string): void {
	const result = spawnSync("bun", ["install", "--lockfile-only"], {
		cwd: targetRoot,
		encoding: "utf8",
		stdio: "pipe",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || result.stdout.trim());
	}
}

export function createAuthlessTemplate(
	targetDirectory: string,
	options: CreateAuthlessOptions = {},
): string {
	const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
	const targetRoot = path.resolve(targetDirectory);
	if (
		targetRoot === repositoryRoot ||
		repositoryRoot.startsWith(`${targetRoot}${path.sep}`)
	) {
		throw new Error("Target must not be the repository or one of its parents.");
	}
	if (fs.existsSync(targetRoot)) {
		throw new Error(`Target already exists: ${targetRoot}`);
	}
	if (!fs.existsSync(path.join(repositoryRoot, "templates", "authless"))) {
		throw new Error("Run this command from the hono-standard repository root.");
	}
	const files = repositoryFiles(repositoryRoot);

	fs.mkdirSync(targetRoot, { recursive: false });
	try {
		for (const relativePath of files) {
			copyRepositoryFile(repositoryRoot, targetRoot, relativePath);
		}
		for (const relativePath of REMOVED_PATHS) {
			fs.rmSync(path.join(targetRoot, relativePath), {
				recursive: true,
				force: true,
			});
		}
		copyDirectory(
			path.join(repositoryRoot, "templates", "authless"),
			targetRoot,
		);
		fs.mkdirSync(path.join(targetRoot, "drizzle"), { recursive: true });
		updatePackageManifest(targetRoot);
		if (options.updateLockfile ?? true) refreshLockfile(targetRoot);
	} catch (error) {
		fs.rmSync(targetRoot, { recursive: true, force: true });
		throw error;
	}
	return targetRoot;
}

if (import.meta.main) {
	const targetDirectory = process.argv[2];
	if (!targetDirectory) {
		console.error("Usage: bun run template:authless -- <new-directory>");
		process.exit(1);
	}
	const targetRoot = createAuthlessTemplate(targetDirectory);
	console.log(`created authless template: ${targetRoot}`);
}
