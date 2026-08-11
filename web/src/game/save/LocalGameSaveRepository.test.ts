import { describe, expect, it } from "vitest";
import { createInitialGameState } from "@shared/game";
import { validateGameContentDirectory } from "../../../../scripts/validate-game-content";
import {
	gameSaveStorageKey,
	LocalGameSaveRepository,
	type GameSaveStorage,
} from "./LocalGameSaveRepository";

const registry = validateGameContentDirectory();

class MemoryStorage implements GameSaveStorage {
	readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}
}

describe("LocalGameSaveRepository", () => {
	it("normalizes a player-specific storage key", () => {
		expect(gameSaveStorageKey(" Player@Example.com ")).toBe(
			"echoes-at-dawn:autosave:player%40example.com",
		);
		expect(() => gameSaveStorageKey(" ")).toThrow("Player ID");
	});

	it("returns empty, saves, loads, and clears an autosave", () => {
		const storage = new MemoryStorage();
		const repository = new LocalGameSaveRepository(
			storage,
			"player@example.com",
		);
		expect(repository.load()).toEqual({ status: "empty" });

		const state = createInitialGameState({ registry, rngSeed: 42 });
		const written = repository.save(state, "2026-08-10T00:00:00.000Z");
		expect(written).toMatchObject({ ok: true });
		expect(repository.load()).toMatchObject({
			status: "ready",
			migrated: false,
			save: { state: { rng: { seed: 42 } } },
		});
		expect(repository.clear()).toBe(true);
		expect(repository.load()).toEqual({ status: "empty" });
	});

	it("keeps different players in separate keys", () => {
		const storage = new MemoryStorage();
		const playerA = new LocalGameSaveRepository(storage, "a@example.com");
		const playerB = new LocalGameSaveRepository(storage, "b@example.com");
		playerA.save(createInitialGameState({ registry }));
		expect(playerA.load().status).toBe("ready");
		expect(playerB.load()).toEqual({ status: "empty" });
	});

	it("reports storage read, write, validation, and clear failures", () => {
		const throwingStorage: GameSaveStorage = {
			getItem: () => {
				throw new Error("read failed");
			},
			setItem: () => {
				throw new Error("write failed");
			},
			removeItem: () => {
				throw new Error("clear failed");
			},
		};
		const repository = new LocalGameSaveRepository(
			throwingStorage,
			"player@example.com",
		);
		expect(repository.load()).toEqual({
			status: "error",
			message: "Browser storage is unavailable.",
		});
		expect(repository.save(createInitialGameState({ registry }))).toEqual({
			ok: false,
			message: "Could not write the local autosave.",
		});
		expect(repository.clear()).toBe(false);

		const invalidRepository = new LocalGameSaveRepository(
			new MemoryStorage(),
			"player@example.com",
		);
		expect(
			invalidRepository.save(
				createInitialGameState({ registry }),
				"invalid-date",
			),
		).toEqual({
			ok: false,
			message: "Could not write the local autosave.",
		});
	});
});
