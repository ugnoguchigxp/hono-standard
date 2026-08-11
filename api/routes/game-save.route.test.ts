import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import {
	AUTOSAVE_SLOT_ID,
	createGameSave,
	createInitialGameState,
} from "../../shared/game";
import { GAME_IDS } from "../../shared/game-platform";
import { GAME_SAVE_PROTOCOL_VERSION } from "../../shared/schemas/game-save.schema";
import { HttpError } from "../modules/auth/errors";
import { createGameSaveRoute } from "./game-save.route";

const userId = "a1a1a1a1-a1a1-41a1-a1a1-a1a1a1a1a1a1";
const registry = validateGameContentDirectory();
const save = createGameSave(
	createInitialGameState({ registry, rngSeed: 42 }),
	"2026-08-11T00:00:00.000Z",
);
const path = `/${GAME_IDS.rpg2d}/saves/${AUTOSAVE_SLOT_ID}`;

const createTestApp = () => {
	const service = {
		load: vi.fn(),
		listSlots: vi.fn(),
		listHistory: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		delete: vi.fn(),
	};
	const app = new Hono();
	app.onError((error, c) =>
		error instanceof HttpError
			? c.json(
					{ message: error.message },
					error.status as 400 | 401 | 404 | 409 | 413 | 500,
				)
			: c.json({ message: "Internal server error" }, 500),
	);
	app.use("*", async (c, next) => {
		c.set("authUser", {
			userId,
			email: "player@example.com",
			role: "member",
		});
		await next();
	});
	app.route("/", createGameSaveRoute(service));
	return { app, service };
};

describe("game save route", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("loads only the authenticated user's autosave", async () => {
		const { app, service } = createTestApp();
		service.load.mockResolvedValue({
			revision: 2,
			save,
			updatedAt: "2026-08-11T00:00:01.000Z",
		});

		const response = await app.request(path);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ save: { revision: 2 } });
		expect(service.load).toHaveBeenCalledWith(
			userId,
			GAME_IDS.rpg2d,
			AUTOSAVE_SLOT_ID,
		);
	});

	it("lists slot metadata and history without exposing save payloads", async () => {
		const { app, service } = createTestApp();
		service.listSlots.mockResolvedValue([
			{
				slotId: "manual-1",
				revision: 2,
				savedAt: save.savedAt,
				updatedAt: save.savedAt,
				contentVersion: save.state.contentVersion,
				stateRevision: save.state.revision,
				mapId: save.state.location.mapId,
				checkpointId: save.state.location.checkpointId,
				status: "ready",
			},
		]);
		service.listHistory.mockResolvedValue([
			{
				slotId: "manual-1",
				revision: 1,
				savedAt: save.savedAt,
				updatedAt: save.savedAt,
				contentVersion: save.state.contentVersion,
				stateRevision: save.state.revision,
				mapId: save.state.location.mapId,
				checkpointId: save.state.location.checkpointId,
				status: "ready",
				checksum: "abc",
			},
		]);

		const slotsResponse = await app.request(`/${GAME_IDS.rpg2d}/saves`);
		expect(slotsResponse.status).toBe(200);
		const slotsJson = await slotsResponse.json();
		expect(slotsJson).toMatchObject({ slots: [{ slotId: "manual-1" }] });
		expect(JSON.stringify(slotsJson)).not.toContain("saveJson");

		const historyResponse = await app.request(
			`/${GAME_IDS.rpg2d}/saves/manual-1/history`,
		);
		expect(historyResponse.status).toBe(200);
		expect(await historyResponse.json()).toMatchObject({
			history: [{ revision: 1, checksum: "abc" }],
		});
		expect(service.listHistory).toHaveBeenCalledWith(
			userId,
			GAME_IDS.rpg2d,
			"manual-1",
		);
	});

	it("restores a history revision as a new current revision", async () => {
		const { app, service } = createTestApp();
		service.restore.mockResolvedValue({
			record: {
				revision: 4,
				save,
				updatedAt: save.savedAt,
			},
			idempotent: false,
		});
		const idempotencyKey = crypto.randomUUID();
		const response = await app.request(
			`/${GAME_IDS.rpg2d}/saves/autosave/history/2/restore`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					protocolVersion: GAME_SAVE_PROTOCOL_VERSION,
					expectedRevision: 3,
					idempotencyKey,
				}),
			},
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ save: { revision: 4 } });
		expect(service.restore).toHaveBeenCalledWith(
			userId,
			GAME_IDS.rpg2d,
			"autosave",
			2,
			3,
			idempotencyKey,
		);
	});

	it("validates and writes a current save with revision and idempotency data", async () => {
		const { app, service } = createTestApp();
		service.save.mockResolvedValue({
			record: {
				revision: 1,
				save,
				updatedAt: "2026-08-11T00:00:01.000Z",
			},
			idempotent: false,
		});
		const idempotencyKey = "b2b2b2b2-b2b2-42b2-b2b2-b2b2b2b2b2b2";

		const response = await app.request(path, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				protocolVersion: GAME_SAVE_PROTOCOL_VERSION,
				intent: "advance",
				save,
				baseRevision: null,
				expectedRevision: null,
				idempotencyKey,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			save: { revision: 1 },
			idempotent: false,
		});
		expect(service.save).toHaveBeenCalledWith({
			userId,
			gameId: GAME_IDS.rpg2d,
			slotId: AUTOSAVE_SLOT_ID,
			save,
			intent: "advance",
			baseRevision: null,
			expectedRevision: null,
			idempotencyKey,
		});
	});

	it("rejects malformed, legacy, mismatched, oversized, and unknown slots", async () => {
		const malformed = createTestApp();
		expect(
			(
				await malformed.app.request(path, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ save: {}, expectedRevision: null }),
				})
			).status,
		).toBe(400);

		const legacy = createTestApp();
		expect(
			(
				await legacy.app.request(path, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						protocolVersion: GAME_SAVE_PROTOCOL_VERSION,
						intent: "advance",
						save: { formatVersion: 0 },
						baseRevision: null,
						expectedRevision: null,
						idempotencyKey: crypto.randomUUID(),
					}),
				})
			).status,
		).toBe(400);

		const oversized = createTestApp();
		expect(
			(
				await oversized.app.request(path, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						protocolVersion: GAME_SAVE_PROTOCOL_VERSION,
						intent: "advance",
						save: { padding: "x".repeat(256 * 1024) },
						baseRevision: null,
						expectedRevision: null,
						idempotencyKey: crypto.randomUUID(),
					}),
				})
			).status,
		).toBe(413);

		const unknown = createTestApp();
		expect((await unknown.app.request("/unknown/saves/autosave")).status).toBe(
			404,
		);
	});

	it("deletes only the authenticated user's slot", async () => {
		const { app, service } = createTestApp();
		service.delete.mockResolvedValue(true);

		const response = await app.request(path, { method: "DELETE" });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ deleted: true });
		expect(service.delete).toHaveBeenCalledWith(
			userId,
			GAME_IDS.rpg2d,
			AUTOSAVE_SLOT_ID,
		);
	});

	it("rejects a delayed request after the authenticated account changes", async () => {
		const { app, service } = createTestApp();

		const response = await app.request(path, {
			headers: { "X-Game-Save-Owner": "other@example.com" },
		});

		expect(response.status).toBe(403);
		expect(service.load).not.toHaveBeenCalled();
	});
});
