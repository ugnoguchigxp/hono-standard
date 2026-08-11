import type { BattleCombatant, BattleEvent } from "@shared/game";

export const getNextEnemyIntentLabel = (enemy: BattleCombatant): string => {
	const patternId = enemy.aiPattern[enemy.turnsTaken % enemy.aiPattern.length];
	return (
		enemy.abilities.find(({ id }) => id === patternId)?.name ?? "Attack"
	).toUpperCase();
};

export type AnimatedBattleEvent = Extract<
	BattleEvent,
	{
		type:
			| "action.damage"
			| "action.defend"
			| "action.heal"
			| "item.used"
			| "status.applied";
	}
>;

export function splitBattlePresentationEvents(events: readonly BattleEvent[]): {
	action: AnimatedBattleEvent | null;
	afterAction: BattleEvent[];
} {
	const actionIndex = events.findIndex((event) =>
		[
			"action.damage",
			"action.defend",
			"action.heal",
			"item.used",
			"status.applied",
		].includes(event.type),
	);
	if (actionIndex < 0) return { action: null, afterAction: [...events] };
	return {
		action: events[actionIndex] as AnimatedBattleEvent,
		afterAction: events.filter((_, index) => index !== actionIndex),
	};
}
