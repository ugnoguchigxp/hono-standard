import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../../../scripts/validate-game-content";
import { createInitialGameState } from "@shared/game";
import {
	getRequiredAssetIdsForMap,
	getRequiredAssetsForState,
} from "./content-assets";

const registry = validateGameContentDirectory();

describe("content asset selection", () => {
	it("selects only the current map, battle, and reachable event images", () => {
		expect(getRequiredAssetIdsForMap(registry, "signal-ruins")).toEqual([
			"signal-ruins-world-v2",
			"signal-ruins-battle",
			"signal-ruins-field",
		]);
		expect(getRequiredAssetIdsForMap(registry, "relay-camp")).toEqual([
			"relay-camp-field",
			"signal-ruins-battle",
		]);
	});

	it("returns manifest-backed asset definitions for boot", () => {
		const state = createInitialGameState({ registry });
		expect(
			getRequiredAssetsForState(registry, state).map(({ id }) => id),
		).not.toContain("relay-camp-field");
		state.event = {
			eventId: "relay-camp-council",
			nodeId: "council-opens",
			status: "running",
			visibleLine: null,
			choices: [],
			actors: [],
		};
		expect(
			getRequiredAssetsForState(registry, state).map(({ id }) => id),
		).toContain("relay-camp-field");
	});
});
