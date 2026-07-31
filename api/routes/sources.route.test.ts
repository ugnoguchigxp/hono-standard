import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSourcesRoute } from "./sources.route";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

const jsonRequest = (method: string, body?: unknown): RequestInit => ({
	method,
	headers: body === undefined ? undefined : { "Content-Type": "application/json" },
	body: body === undefined ? undefined : JSON.stringify(body),
});

async function readJson<T>(response: Response): Promise<T> {
	return (await response.json()) as T;
}

describe("sources route", () => {
	it("supports the complete wiki CRUD, search, history and reindex lifecycle", async () => {
		const contentRoot = await mkdtemp(
			path.join(os.tmpdir(), "hono-rag-sources-route-"),
		);
		tempDirs.push(contentRoot);

		let sourceSequence = 0;
		const sourceRepository = {
			listCategories: vi.fn().mockResolvedValue(["indexed"]),
			upsertSourceDocument: vi.fn().mockImplementation(async () => {
				sourceSequence += 1;
				return `source-${sourceSequence}`;
			}),
			deleteSourceByUri: vi.fn().mockResolvedValue(undefined),
			deleteStaleSourcesForRoot: vi.fn().mockResolvedValue(1),
		};
		const wikiBlobSyncer = {
			pull: vi.fn().mockResolvedValue(undefined),
			push: vi.fn().mockResolvedValue(undefined),
		};
		const app = new Hono().route(
			"/api/sources",
			createSourcesRoute({
				contentRoot,
				sourceRepository: sourceRepository as never,
				wikiBlobSyncer: wikiBlobSyncer as never,
			}),
		);

		const health = await app.request("/api/sources/health");
		expect(health.status).toBe(200);
		expect(await readJson(health)).toMatchObject({
			service: "hono-standard-rag",
			git: null,
		});
		expect(wikiBlobSyncer.pull).toHaveBeenCalledWith({ force: undefined });

		execFileSync("git", ["-C", contentRoot, "config", "user.name", "RAG Test"]);
		execFileSync("git", [
			"-C",
			contentRoot,
			"config",
			"user.email",
			"rag-test@example.com",
		]);

		const initialTree = await readJson<{
			items: Array<{ slug: string }>;
			folders: Array<{ path: string }>;
		}>(await app.request("/api/sources/tree"));
		expect(initialTree.items.map((item) => item.slug)).toContain("tech");
		expect(initialTree.folders.map((item) => item.path)).toContain("tech");

		const initialCategories = await readJson<{ items: string[] }>(
			await app.request("/api/sources/categories"),
		);
		expect(initialCategories.items).toEqual(["indexed", "tech"]);

		expect(
			(
				await app.request(
					"/api/sources/folders",
					jsonRequest("POST", { path: "ops" }),
				)
			).status,
		).toBe(200);
		expect(wikiBlobSyncer.push).toHaveBeenCalledTimes(1);
		expect(
			(
				await app.request(
					"/api/sources/folders",
					jsonRequest("POST", { path: "ops" }),
				)
			).status,
		).toBe(409);
		expect(
			(
				await app.request(
					"/api/sources/folders",
					jsonRequest("POST", { path: ".." }),
				)
			).status,
		).toBe(400);

		const createPage = await app.request(
			"/api/sources/pages",
			jsonRequest("POST", {
				slug: "ops/runbook",
				title: "Operations Runbook",
				body: "# Runbook\n\nDeploy the cobalt service safely.\n<script>bad()</script>",
				meta: { tags: ["deploy", "cobalt"] },
			}),
		);
		expect(createPage.status).toBe(200);
		const created = await readJson<{
			ok: boolean;
			slug: string;
			hash: string;
			commit: string;
		}>(createPage);
		expect(created).toMatchObject({ ok: true, slug: "ops/runbook" });
		expect(created.hash).toHaveLength(64);
		expect(created.commit).toHaveLength(7);
		expect(sourceRepository.upsertSourceDocument).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceKind: "wiki",
				category: "ops",
				title: "Operations Runbook",
				metadata: expect.objectContaining({ wikiSlug: "ops/runbook" }),
			}),
		);

		expect(
			(
				await app.request(
					"/api/sources/pages",
					jsonRequest("POST", {
						slug: "ops/runbook",
						title: "Duplicate",
						body: "duplicate",
					}),
				)
			).status,
		).toBe(409);

		const page = await readJson<{
			slug: string;
			title: string;
			body: string;
			meta: { tags: string[] };
		}>(await app.request("/api/sources/pages/ops/runbook"));
		expect(page).toMatchObject({
			slug: "ops/runbook",
			title: "Operations Runbook",
			meta: { tags: ["deploy", "cobalt"] },
		});
		expect(page.body).not.toContain("<script>");

		const raw = await app.request("/api/sources/pages/ops/runbook/raw");
		expect(raw.headers.get("content-type")).toContain("text/markdown");
		expect(await raw.text()).toContain("cobalt service");
		expect(
			(await app.request("/api/sources/pages/missing/raw")).status,
		).toBe(404);

		const emptySearch = await readJson<{ items: unknown[] }>(
			await app.request("/api/sources/search?q=%20"),
		);
		expect(emptySearch.items).toEqual([]);
		const search = await readJson<{
			items: Array<{ slug: string; excerpt: string }>;
		}>(await app.request("/api/sources/search?q=cobalt"));
		expect(search.items).toEqual([
			expect.objectContaining({ slug: "ops/runbook" }),
		]);
		const missingSearch = await readJson<{ items: unknown[] }>(
			await app.request("/api/sources/search?q=not-present"),
		);
		expect(missingSearch.items).toEqual([]);

		const updatePage = await app.request(
			"/api/sources/pages/ops/runbook",
			jsonRequest("PUT", {
				body: "# Runbook\n\nDeploy the indigo service safely.",
				commitMessage: "docs: update runbook",
			}),
		);
		expect(updatePage.status).toBe(200);
		const updated = await readJson<{ commit: string }>(updatePage);

		const history = await readJson<{
			items: Array<{ commit: string; message: string }>;
		}>(await app.request("/api/sources/history/ops/runbook"));
		expect(history.items).toHaveLength(2);
		expect(history.items[0]?.message).toBe("docs: update runbook");

		expect(
			(await app.request("/api/sources/diff/ops/runbook")).status,
		).toBe(400);
		const diff = await readJson<{ diff: string }>(
			await app.request(
				`/api/sources/diff/ops/runbook?from=${created.commit}&to=${updated.commit}`,
			),
		);
		expect(diff.diff).toContain("indigo");

		const renamePage = await app.request(
			"/api/sources/pages/ops/runbook",
			jsonRequest("PUT", {
				slug: "ops/guide",
				title: "Operations Guide",
				body: "# Guide\n\nRenamed content.",
			}),
		);
		expect(renamePage.status).toBe(200);
		expect(await readJson(renamePage)).toMatchObject({ slug: "ops/guide" });
		expect(sourceRepository.deleteSourceByUri).toHaveBeenCalledTimes(1);
		expect(
			(await app.request("/api/sources/pages/ops/runbook")).status,
		).toBe(404);

		expect(
			(
				await app.request(
					"/api/sources/pages",
					jsonRequest("POST", {
						slug: "ops/existing",
						title: "Existing",
						body: "# Existing",
					}),
				)
			).status,
		).toBe(200);
		expect(
			(
				await app.request(
					"/api/sources/pages/ops/guide",
					jsonRequest("PUT", {
						slug: "ops/existing",
						body: "# Conflict",
					}),
				)
			).status,
		).toBe(409);

		const renameFolder = await app.request(
			"/api/sources/folders/ops",
			jsonRequest("PUT", { path: "platform" }),
		);
		expect(renameFolder.status).toBe(200);
		expect(await readJson(renameFolder)).toMatchObject({
			from: "ops",
			path: "platform",
			movedPages: expect.arrayContaining([
				{ from: "ops/guide", to: "platform/guide" },
			]),
		});
		expect(sourceRepository.deleteStaleSourcesForRoot).toHaveBeenCalled();

		expect(
			(
				await app.request(
					"/api/sources/folders/platform",
					jsonRequest("PUT", { path: "platform" }),
				)
			).status,
		).toBe(400);
		expect(
			(
				await app.request(
					"/api/sources/folders/platform",
					jsonRequest("PUT", { path: "platform/nested" }),
				)
			).status,
		).toBe(400);
		expect(
			(
				await app.request(
					"/api/sources/folders/missing",
					jsonRequest("PUT", { path: "elsewhere" }),
				)
			).status,
		).toBe(404);

		const reindex = await app.request(
			"/api/sources/reindex",
			jsonRequest("POST"),
		);
		expect(reindex.status).toBe(200);
		expect(await readJson(reindex)).toMatchObject({
			ok: true,
			removedSources: 1,
		});
		expect(wikiBlobSyncer.pull).toHaveBeenCalledWith({ force: true });

		expect(
			(await app.request("/api/sources/pages/platform/guide", { method: "DELETE" }))
				.status,
		).toBe(200);
		expect(
			(await app.request("/api/sources/pages/platform/guide", { method: "DELETE" }))
				.status,
		).toBe(404);

		const deleteFolder = await app.request(
			"/api/sources/folders/platform",
			{ method: "DELETE" },
		);
		expect(deleteFolder.status).toBe(200);
		expect(await readJson(deleteFolder)).toMatchObject({
			ok: true,
			path: "platform",
			deletedSlugs: ["platform/existing"],
		});
		expect(
			(
				await app.request("/api/sources/folders/platform", {
					method: "DELETE",
				})
			).status,
		).toBe(404);
		expect(
			(await app.request("/api/sources/folders/%E0%A4%A", { method: "DELETE" }))
				.status,
		).toBe(400);
	}, 20_000);
});
