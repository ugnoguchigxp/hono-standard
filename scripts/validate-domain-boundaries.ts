import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

type DomainOwner =
	| "rpg-domain"
	| "rpg-web"
	| "action3d-domain"
	| "action3d-web"
	| "shared-platform"
	| "web-platform"
	| "other";

export type DomainBoundaryIssue = {
	sourcePath: string;
	specifier: string;
	rule: string;
};

const sourceRoots = ["shared", "web/src"] as const;

const forbiddenTargets: Record<DomainOwner, ReadonlySet<DomainOwner>> = {
	"rpg-domain": new Set([
		"action3d-domain",
		"action3d-web",
		"rpg-web",
		"web-platform",
	]),
	"rpg-web": new Set(["action3d-domain", "action3d-web"]),
	"action3d-domain": new Set([
		"rpg-domain",
		"rpg-web",
		"action3d-web",
		"web-platform",
	]),
	"action3d-web": new Set(["rpg-domain", "rpg-web"]),
	"shared-platform": new Set([
		"rpg-domain",
		"rpg-web",
		"action3d-domain",
		"action3d-web",
		"web-platform",
	]),
	"web-platform": new Set([
		"rpg-domain",
		"rpg-web",
		"action3d-domain",
		"action3d-web",
	]),
	other: new Set(),
};

const normalize = (value: string): string => value.split(path.sep).join("/");

const ownerOf = (projectRoot: string, targetPath: string): DomainOwner => {
	const relative = normalize(path.relative(projectRoot, targetPath));
	if (
		relative === "shared/game-platform" ||
		relative.startsWith("shared/game-platform/")
	) {
		return "shared-platform";
	}
	if (
		relative === "shared/action3d" ||
		relative.startsWith("shared/action3d/")
	) {
		return "action3d-domain";
	}
	if (relative === "shared/game" || relative.startsWith("shared/game/")) {
		return "rpg-domain";
	}
	if (
		relative === "web/src/game-platform" ||
		relative.startsWith("web/src/game-platform/")
	) {
		return "web-platform";
	}
	if (
		relative === "web/src/action3d" ||
		relative.startsWith("web/src/action3d/")
	) {
		return "action3d-web";
	}
	if (relative === "web/src/game" || relative.startsWith("web/src/game/")) {
		return "rpg-web";
	}
	return "other";
};

const resolveImport = (
	projectRoot: string,
	sourcePath: string,
	specifier: string,
): string | null => {
	if (specifier.startsWith("@shared/")) {
		return path.join(projectRoot, "shared", specifier.slice("@shared/".length));
	}
	if (specifier.startsWith("@web/")) {
		return path.join(projectRoot, "web/src", specifier.slice("@web/".length));
	}
	if (specifier.startsWith("@/")) {
		return path.join(projectRoot, "web/src", specifier.slice("@/".length));
	}
	if (specifier.startsWith(".")) {
		return path.resolve(path.dirname(sourcePath), specifier);
	}
	return null;
};

const listSourceFiles = (directory: string): string[] => {
	if (!statSync(directory).isDirectory()) return [];
	return readdirSync(directory).flatMap((entry) => {
		const target = path.join(directory, entry);
		return statSync(target).isDirectory()
			? listSourceFiles(target)
			: /\.[cm]?[jt]sx?$/.test(entry)
				? [target]
				: [];
	});
};

const importSpecifiers = (filePath: string): string[] => {
	const source = ts.createSourceFile(
		filePath,
		readFileSync(filePath, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
	const specifiers: string[] = [];
	const visit = (node: ts.Node): void => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			specifiers.push(node.moduleSpecifier.text);
		}
		if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments.length === 1 &&
			ts.isStringLiteral(node.arguments[0])
		) {
			specifiers.push(node.arguments[0].text);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return specifiers;
};

export function validateDomainBoundaries(
	projectRoot = process.cwd(),
): DomainBoundaryIssue[] {
	const issues: DomainBoundaryIssue[] = [];
	for (const sourceRoot of sourceRoots) {
		const absoluteRoot = path.join(projectRoot, sourceRoot);
		for (const sourcePath of listSourceFiles(absoluteRoot)) {
			const sourceOwner = ownerOf(projectRoot, sourcePath);
			if (sourceOwner === "other") continue;
			for (const specifier of importSpecifiers(sourcePath)) {
				const resolved = resolveImport(projectRoot, sourcePath, specifier);
				if (!resolved) continue;
				const targetOwner = ownerOf(projectRoot, resolved);
				if (!forbiddenTargets[sourceOwner].has(targetOwner)) continue;
				issues.push({
					sourcePath: normalize(path.relative(projectRoot, sourcePath)),
					specifier,
					rule: `${sourceOwner} must not import ${targetOwner}`,
				});
			}
		}
	}
	return issues;
}

if (import.meta.main) {
	const issues = validateDomainBoundaries();
	if (issues.length > 0) {
		console.error("FAIL game domain boundaries");
		for (const issue of issues) {
			console.error(
				`${issue.sourcePath}: ${issue.rule} via '${issue.specifier}'`,
			);
		}
		process.exit(1);
	}
	console.log("OK game domain boundaries");
}
