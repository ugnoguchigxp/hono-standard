import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./demo-state";
import {
	decodeGameSave,
	GAME_SAVE_FORMAT_VERSION,
	serializeGameSave,
} from "./save-codec";
import { GAME_STATE_SCHEMA_VERSION } from "./model";

const savedAt = "2026-08-10T00:00:00.000Z";

const createLegacySave = () => {
	const current = createInitialGameState();
	return {
		formatVersion: 0,
		savedAt,
		state: {
			schemaVersion: 1,
			mode: current.mode,
			currentMap: current.currentMap,
			party: current.party,
			story: current.story,
			battle: current.battle,
		},
	};
};

describe("game save codec", () => {
	it("round-trips a current versioned save", () => {
		const state = createInitialGameState({ rngSeed: 42 });
		state.story.flags["signal-contacted"] = true;
		const result = decodeGameSave(serializeGameSave(state, savedAt));

		expect(result.status).toBe("ready");
		if (result.status !== "ready") return;
		expect(result.migrated).toBe(false);
		expect(result.save).toEqual({
			formatVersion: GAME_SAVE_FORMAT_VERSION,
			slotId: "autosave",
			savedAt,
			state,
		});
	});

	it("migrates a legacy v1 Game State into the current shape", () => {
		const legacy = createLegacySave();
		legacy.state.currentMap.checkpoint = { x: 8, y: 5 };
		legacy.state.story.flags["legacy-flag"] = true;
		const result = decodeGameSave(JSON.stringify(legacy));

		expect(result.status).toBe("ready");
		if (result.status !== "ready") return;
		expect(result.migrated).toBe(true);
		expect(result.save.state.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
		expect(result.save.state.revision).toBe(0);
		expect(result.save.state.field.partyPositions).toEqual([
			{ x: 8, y: 5 },
			{ x: 7, y: 5 },
			{ x: 6, y: 5 },
		]);
		expect(result.save.state.story.flags["legacy-flag"]).toBe(true);
	});

	it("classifies invalid JSON, values, and current schema mismatches", () => {
		expect(decodeGameSave("{")).toEqual({
			status: "corrupt",
			message: "Save data is not valid JSON.",
		});
		expect(decodeGameSave("[]")).toEqual({
			status: "corrupt",
			message: "Save data must be an object.",
		});
		expect(decodeGameSave("{}")).toEqual({
			status: "corrupt",
			message: "Save format version is missing.",
		});
		expect(
			decodeGameSave(
				JSON.stringify({
					formatVersion: GAME_SAVE_FORMAT_VERSION,
					slotId: "autosave",
					savedAt,
					state: { schemaVersion: GAME_STATE_SCHEMA_VERSION },
				}),
			),
		).toEqual({
			status: "corrupt",
			message: "Save data does not match the current schema.",
		});
		expect(
			decodeGameSave(
				JSON.stringify({
					formatVersion: GAME_SAVE_FORMAT_VERSION,
					state: null,
				}),
			),
		).toMatchObject({ status: "corrupt" });
	});

	it("separates unsupported save and state versions from corruption", () => {
		expect(
			decodeGameSave(JSON.stringify({ formatVersion: 99 })),
		).toMatchObject({ status: "unsupported", formatVersion: 99 });
		expect(
			decodeGameSave(
				JSON.stringify({
					formatVersion: GAME_SAVE_FORMAT_VERSION,
					state: { schemaVersion: 999 },
				}),
			),
		).toMatchObject({ status: "unsupported", stateVersion: 999 });

		const unsupportedLegacy = createLegacySave();
		unsupportedLegacy.state.schemaVersion = 99;
		expect(
			decodeGameSave(JSON.stringify(unsupportedLegacy)),
		).toMatchObject({ status: "unsupported", stateVersion: 99 });

		const corruptLegacy = createLegacySave() as Record<string, unknown>;
		corruptLegacy.state = { schemaVersion: 1 };
			expect(decodeGameSave(JSON.stringify(corruptLegacy))).toEqual({
			status: "corrupt",
			message: "Legacy save data is incomplete or corrupt.",
		});
		expect(
			decodeGameSave(JSON.stringify({ formatVersion: 0, state: null })),
		).toMatchObject({ status: "corrupt" });
	});

	it("rejects invalid state and save timestamps when encoding", () => {
		expect(() =>
			serializeGameSave(createInitialGameState(), "not-a-date"),
		).toThrow();
		const state = createInitialGameState();
		state.rng.state = -1;
		expect(() => serializeGameSave(state, savedAt)).toThrow();
	});
});
