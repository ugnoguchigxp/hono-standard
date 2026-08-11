import { describe, expect, it } from "vitest";
import { createSignalRuinsEncounterState, type BattleEvent } from "@shared/game";
import {
	getNextEnemyIntentLabel,
	splitBattlePresentationEvents,
} from "./battle-presentation";

describe("battle presentation", () => {
	it("keeps terminal events until after the action animation", () => {
		const events: BattleEvent[] = [
			{
				type: "action.damage",
				actorId: "mira",
				targetId: "warden",
				amount: 12,
				element: "physical",
				multiplier: 1,
			},
			{ type: "combatant.defeated", combatantId: "warden" },
			{ type: "battle.ended", result: "victory" },
		];

		expect(splitBattlePresentationEvents(events)).toEqual({
			action: events[0],
			afterAction: events.slice(1),
		});
	});

	it("returns informational events unchanged when no animation is needed", () => {
		const events: BattleEvent[] = [{ type: "gauge.ready", actorId: "mira" }];
		expect(splitBattlePresentationEvents(events)).toEqual({
			action: null,
			afterAction: events,
		});
	});

	it("telegraphs the next enemy ability from its deterministic pattern", () => {
		const enemy = createSignalRuinsEncounterState().enemies[0];
		enemy.abilities = [
			{ ...enemy.ability, id: "lunge", name: "Lunge" },
			{ ...enemy.ability, id: "ruin-pulse", name: "Ruin Pulse" },
		];
		enemy.aiPattern = ["lunge", "ruin-pulse"];

		expect(getNextEnemyIntentLabel(enemy)).toBe("LUNGE");
		enemy.turnsTaken = 1;
		expect(getNextEnemyIntentLabel(enemy)).toBe("RUIN PULSE");
		enemy.aiPattern = [];
		expect(getNextEnemyIntentLabel(enemy)).toBe("ATTACK");
	});
});
