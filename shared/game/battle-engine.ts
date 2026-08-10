import {
	ACTION_GAUGE_MAX,
	type BattleCombatant,
	type BattleCommand,
	type BattleEvent,
	type BattleState,
	type BattleTransition,
} from "./model";

const GAUGE_PER_SPEED_PER_SECOND = 12;

export class BattleRuleError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BattleRuleError";
	}
}

const isAlive = (combatant: BattleCombatant): boolean => combatant.hp > 0;

const cloneState = (state: BattleState): BattleState => ({
	...state,
	party: state.party.map((member) => ({ ...member })),
	enemies: state.enemies.map((enemy) => ({ ...enemy })),
});

const allCombatants = (state: BattleState): BattleCombatant[] => [
	...state.party,
	...state.enemies,
];

const getCombatant = (
	state: BattleState,
	combatantId: string,
): BattleCombatant | undefined =>
	allCombatants(state).find((combatant) => combatant.id === combatantId);

const calculateDamage = (
	actor: BattleCombatant,
	target: BattleCombatant,
	powerPercent: number,
): number => {
	const rawDamage = Math.max(
		1,
		Math.floor((actor.attack * powerPercent) / 100) -
			Math.floor(target.defense / 2),
	);
	return target.defending ? Math.max(1, Math.ceil(rawDamage / 2)) : rawDamage;
};

const applyDamage = (
	actor: BattleCombatant,
	target: BattleCombatant,
	powerPercent: number,
	abilityId?: string,
): BattleEvent[] => {
	const damage = calculateDamage(actor, target, powerPercent);
	target.hp = Math.max(0, target.hp - damage);
	target.defending = false;

	const events: BattleEvent[] = [
		{
			type: "action.damage",
			actorId: actor.id,
			targetId: target.id,
			amount: damage,
			...(abilityId ? { abilityId } : {}),
		},
	];
	if (!isAlive(target)) {
		events.push({ type: "combatant.defeated", combatantId: target.id });
	}
	return events;
};

const finishBattleIfNeeded = (state: BattleState): BattleEvent[] => {
	if (!state.enemies.some(isAlive)) {
		state.phase = "victory";
		state.activeActorId = null;
		return [{ type: "battle.ended", result: "victory" }];
	}
	if (!state.party.some(isAlive)) {
		state.phase = "defeat";
		state.activeActorId = null;
		return [{ type: "battle.ended", result: "defeat" }];
	}
	return [];
};

const readyCombatants = (state: BattleState): BattleCombatant[] =>
	allCombatants(state)
		.filter(
			(combatant) =>
				isAlive(combatant) && combatant.actionGauge >= ACTION_GAUGE_MAX,
		)
		.sort(
			(left, right) =>
				right.speed - left.speed || left.id.localeCompare(right.id),
		);

const selectEnemyTarget = (state: BattleState): BattleCombatant | undefined =>
	state.party
		.filter(isAlive)
		.sort(
			(left, right) =>
				left.hp / left.maxHp - right.hp / right.maxHp ||
				left.id.localeCompare(right.id),
		)[0];

export function advanceBattle(
	state: BattleState,
	deltaMs: number,
): BattleTransition {
	if (state.phase !== "running" || !Number.isFinite(deltaMs) || deltaMs <= 0) {
		return { state, events: [] };
	}

	const next = cloneState(state);
	next.elapsedMs += deltaMs;
	for (const combatant of allCombatants(next)) {
		if (!isAlive(combatant)) continue;
		combatant.actionGauge = Math.min(
			ACTION_GAUGE_MAX,
			combatant.actionGauge +
				(combatant.speed * GAUGE_PER_SPEED_PER_SECOND * deltaMs) / 1_000,
		);
	}

	const events: BattleEvent[] = [];
	for (const ready of readyCombatants(next)) {
		if (ready.side === "party") {
			next.phase = "awaiting-command";
			next.activeActorId = ready.id;
			events.push({ type: "gauge.ready", actorId: ready.id });
			break;
		}

		const target = selectEnemyTarget(next);
		if (!target) break;
		events.push(...applyDamage(ready, target, 100));
		ready.actionGauge = 0;
		events.push(...finishBattleIfNeeded(next));
		if (next.phase !== "running") break;
	}

	return { state: next, events };
}

export function applyBattleCommand(
	state: BattleState,
	command: BattleCommand,
): BattleTransition {
	if (
		state.phase !== "awaiting-command" ||
		state.activeActorId !== command.actorId
	) {
		throw new BattleRuleError("The actor is not ready to receive a command.");
	}

	const next = cloneState(state);
	const actor = getCombatant(next, command.actorId);
	if (actor?.side !== "party" || !isAlive(actor)) {
		throw new BattleRuleError("The acting party member is unavailable.");
	}

	const events: BattleEvent[] = [];
	if (command.type === "defend") {
		actor.defending = true;
		events.push({ type: "action.defend", actorId: actor.id });
	} else {
		const target = getCombatant(next, command.targetId);
		if (target?.side !== "enemy" || !isAlive(target)) {
			throw new BattleRuleError("The selected enemy target is unavailable.");
		}
		if (command.type === "ability") {
			if (command.abilityId !== actor.ability.id) {
				throw new BattleRuleError("The actor cannot use the selected ability.");
			}
			events.push(
				...applyDamage(
					actor,
					target,
					actor.ability.powerPercent,
					actor.ability.id,
				),
			);
		} else {
			events.push(...applyDamage(actor, target, 100));
		}
	}

	actor.actionGauge = 0;
	next.activeActorId = null;
	next.phase = "running";
	events.push(...finishBattleIfNeeded(next));
	return { state: next, events };
}
