import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "../modules/auth/auth.service";
import type { AuthContextUser } from "../modules/auth/context";
import type { SettingsRepository } from "../modules/settings/settings.repository";
import { createAdminUsersRoute } from "./admin-users.route";
import { createAgenticSearchRoute } from "./agentic-search.route";
import { createArtifactsRoute } from "./artifacts.route";
import { createSettingsRoute } from "./settings.route";

const userId = "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1";
const artifactId = "b2b2b2b2-b2b2-42b2-b2b2-b2b2b2b2b2b2";
const conversationId = "c3c3c3c3-c3c3-43c3-b3c3-c3c3c3c3c3c3";
const authUser: AuthContextUser = {
	userId,
	email: "admin@example.com",
	role: "admin",
};

function authenticated(route: Hono): Hono {
	return new Hono()
		.use("*", async (c, next) => {
			c.set("authUser", authUser);
			await next();
		})
		.route("/", route);
}

const jsonRequest = (method: string, body: unknown): RequestInit => ({
	method,
	headers: { "content-type": "application/json" },
	body: JSON.stringify(body),
});

const responseUser = {
	id: userId,
	email: "member@example.com",
	displayName: "Member",
	role: "member" as const,
	isActive: true,
	lastLoginAt: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("admin users route", () => {
	it("supports list, creation, profile, password, disable and enable operations", async () => {
		const authService = {
			listUsers: vi.fn().mockResolvedValue([
				responseUser,
				{ ...responseUser, lastLoginAt: new Date("2026-01-03T00:00:00.000Z") },
			]),
			createUser: vi.fn().mockResolvedValue(responseUser),
			updateUserProfile: vi.fn().mockResolvedValue({
				...responseUser,
				displayName: "Renamed",
			}),
			resetPassword: vi.fn().mockResolvedValue(undefined),
			setUserActive: vi
				.fn()
				.mockResolvedValueOnce({ ...responseUser, isActive: false })
				.mockResolvedValueOnce(responseUser),
		};
		const app = authenticated(
			createAdminUsersRoute({
				authService: authService as unknown as AuthService,
			}),
		);

		const list = await app.request("/users");
		expect(list.status).toBe(200);
		expect(await list.json()).toMatchObject({
			items: [
				{ lastLoginAt: null },
				{ lastLoginAt: "2026-01-03T00:00:00.000Z" },
			],
		});

		const create = await app.request(
			"/users",
			jsonRequest("POST", {
				email: " MEMBER@EXAMPLE.COM ",
				displayName: " Member ",
				initialPassword: "password123",
			}),
		);
		expect(create.status).toBe(201);
		expect(authService.createUser).toHaveBeenCalledWith({
			email: "MEMBER@EXAMPLE.COM",
			displayName: "Member",
			password: "password123",
			role: "member",
		});
		expect(
			(
				await app.request(
					"/users/not-a-user",
					jsonRequest("PATCH", { displayName: "Renamed", role: "admin" }),
				)
			).status,
		).toBe(200);
		expect(authService.updateUserProfile).toHaveBeenCalledWith("not-a-user", {
			displayName: "Renamed",
			role: "admin",
		});
		expect(
			(
				await app.request(
					"/users/not-a-user/reset-password",
					jsonRequest("POST", { newPassword: "new-password" }),
				)
			).status,
		).toBe(200);
		expect(
			(await app.request("/users/not-a-user/disable", { method: "POST" }))
				.status,
		).toBe(200);
		expect(
			(await app.request("/users/not-a-user/enable", { method: "POST" })).status,
		).toBe(200);
		expect(authService.setUserActive).toHaveBeenNthCalledWith(
			1,
			userId,
			"not-a-user",
			false,
		);
		expect(authService.setUserActive).toHaveBeenNthCalledWith(
			2,
			userId,
			"not-a-user",
			true,
		);

		expect(
			(
				await app.request(
					"/users",
					jsonRequest("POST", {
						email: "bad",
						displayName: "",
						initialPassword: "short",
					}),
				)
			).status,
		).toBe(400);
	});
});

describe("settings and agentic search routes", () => {
	it("reads and updates the authenticated user's system context", async () => {
		expect(() => createSettingsRoute({} as never)).toThrow(
			"settingsRepository is not configured",
		);
		const settingsRepository = {
			getSystemContextForUser: vi.fn().mockResolvedValue({
				systemContext: "initial",
				instructionLocale: "ja-JP",
				updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
			updateSystemContext: vi.fn().mockResolvedValue({
				systemContext: "updated",
				instructionLocale: "en-US",
				updatedAt: new Date("2026-01-02T00:00:00.000Z"),
			}),
		};
		const app = authenticated(
			createSettingsRoute({
				settingsRepository:
					settingsRepository as unknown as SettingsRepository,
			}),
		);

		expect(await (await app.request("/system-context")).json()).toEqual({
			systemContext: "initial",
			instructionLocale: "ja-JP",
			updatedAt: "2026-01-01T00:00:00.000Z",
		});
		const update = await app.request(
			"/system-context",
			jsonRequest("PUT", {
				systemContext: "updated",
				instructionLocale: "en-US",
			}),
		);
		expect(update.status).toBe(200);
		expect(settingsRepository.updateSystemContext).toHaveBeenCalledWith(
			"updated",
			userId,
			"en-US",
		);
	});

	it("validates, runs and reports failures from agentic search", async () => {
		expect(() => createAgenticSearchRoute({} as never)).toThrow(
			"agentic search service is not configured",
		);
		const result = {
			answer: "answer",
			citations: [],
			toolTrace: [],
			usage: { totalTokens: 2 },
		};
		const service = {
			run: vi
				.fn()
				.mockResolvedValueOnce(result)
				.mockRejectedValueOnce(new Error("runner failed")),
		};
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const app = authenticated(createAgenticSearchRoute({ service: service as never }));
		app.onError((caught, c) => c.json({ message: caught.message }, 500));

		const ok = await app.request(
			"/",
			jsonRequest("POST", {
				query: "  question  ",
				category: "tech",
				topK: 3,
			}),
		);
		expect(ok.status).toBe(200);
		expect(service.run).toHaveBeenCalledWith({
			query: "question",
			userId,
			category: "tech",
			topK: 3,
		});
		expect(
			(
				await app.request(
					"/",
					jsonRequest("POST", { query: "question", category: "bad/path" }),
				)
			).status,
		).toBe(400);
		const failed = await app.request(
			"/",
			jsonRequest("POST", { query: "question" }),
		);
		expect(failed.status).toBe(500);
		expect(service.run).toHaveBeenLastCalledWith({
			query: "question",
			userId,
			category: undefined,
			topK: 8,
		});
		expect(log).toHaveBeenCalled();
		expect(error).toHaveBeenCalled();
		log.mockRestore();
		error.mockRestore();
	});
});

function selectChain(rows: unknown[]) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	for (const method of ["from", "innerJoin", "where", "orderBy"]) {
		chain[method] = vi.fn(() => chain);
	}
	chain.limit = vi.fn().mockResolvedValue(rows);
	return chain;
}

describe("artifacts route", () => {
	it("lists, gets, updates and protects missing artifacts", async () => {
		const artifact = {
			id: artifactId,
			conversationId,
			messageId: "message-1",
			type: "markdown",
			title: "Title",
			content: "content",
			version: 1,
			metadata: { source: "test" },
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		const queues: unknown[][] = [
			[artifact],
			[artifact],
			[],
			[{ id: artifactId, version: 1, metadata: { source: "test" } }],
		];
		const select = vi.fn(() => selectChain(queues.shift() ?? []));
		const returning = vi.fn().mockResolvedValue([{ ...artifact, version: 2 }]);
		const updateChain = {
			set: vi.fn(),
			where: vi.fn(),
			returning,
		};
		updateChain.set.mockReturnValue(updateChain);
		updateChain.where.mockReturnValue(updateChain);
		const db = {
			select,
			update: vi.fn(() => updateChain),
		};
		const app = authenticated(createArtifactsRoute({ db: db as never }));

		const list = await app.request(`/?conversationId=${conversationId}&limit=10`);
		expect(list.status).toBe(200);
		expect(await list.json()).toMatchObject({ items: [{ id: artifactId }] });
		expect((await app.request(`/${artifactId}`)).status).toBe(200);
		expect((await app.request(`/${artifactId}`)).status).toBe(404);

		const update = await app.request(
			`/${artifactId}`,
			jsonRequest("PUT", { title: "Next", content: { ok: true } }),
		);
		expect(update.status).toBe(200);
		expect(updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Next",
				content: { ok: true },
				version: 2,
				metadata: { source: "test" },
				updatedAt: expect.any(Date),
			}),
		);
		expect(
			(
				await app.request(
					"/not-a-uuid",
					jsonRequest("PUT", { content: "content" }),
				)
			).status,
		).toBe(400);
	});
});
