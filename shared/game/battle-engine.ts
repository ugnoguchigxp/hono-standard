import {
	ACTION_GAUGE_MAX,
	type AbilityDefinition,
	type BattleCombatant,
	type BattleCommand,
	type BattleElement,
	type BattleEvent,
	type BattleItemStack,
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

export const isCombatantAlive = (combatant: BattleCombatant): boolean =>
	combatant.hp > 0;

const cloneCombatant = (combatant: BattleCombatant): BattleCombatant => ({
	...combatant,
	ability: { ...combatant.ability },
	abilities: combatant.abilities.map((ability) => ({
		...ability,
		...(ability.statusEffect
			? { statusEffect: { ...ability.statusEffect } }
			: {}),
	})),
	statuses: combatant.statuses.map((status) => ({ ...status })),
	elementMultipliers: { ...combatant.elementMultipliers },
	aiPattern: [...combatant.aiPattern],
});

const cloneItem = (item: BattleItemStack): BattleItemStack => ({
	...item,
	statusIds: [...item.statusIds],
});

const cloneState = (state: BattleState): BattleState => ({
	...state,
	party: state.party.map(cloneCombatant),
	enemies: state.enemies.map(cloneCombatant),
	items: state.items.map(cloneItem),
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

const modifiedStat = (
	combatant: BattleCombatant,
	stat: "attack" | "defense" | "speed",
): number => {
	const percent = combatant.statuses.reduce(
		(total, status) => total + status[`${stat}Percent`],
		0,
	);
	return Math.max(
		stat === "defense" ? 0 : 1,
		combatant[stat] * (1 + percent / 100),
	);
};

const calculateDamage = (
	actor: BattleCombatant,
	target: BattleCombatant,
	powerPercent: number,
	element: BattleElement,
): { amount: number; multiplier: number } => {
	const multiplier = target.elementMultipliers[element] ?? 1;
	const rawDamage = Math.max(
		1,
		Math.floor((modifiedStat(actor, "attack") * powerPercent) / 100) -
			Math.floor(modifiedStat(target, "defense") / 2),
	);
	const elementalDamage = Math.max(1, Math.round(rawDamage * multiplier));
	return {
		amount: target.defending
			? Math.max(1, Math.ceil(elementalDamage / 2))
			: elementalDamage,
		multiplier,
	};
};

const applyDamage = (
	actor: BattleCombatant,
	target: BattleCombatant,
	powerPercent: number,
	element: BattleElement,
	abilityId?: string,
): BattleEvent[] => {
	const { amount, multiplier } = calculateDamage(
		actor,
		target,
		powerPercent,
		element,
	);
	target.hp = Math.max(0, target.hp - amount);
	target.defending = false;

	const events: BattleEvent[] = [
		{
			type: "action.damage",
			actorId: actor.id,
			targetId: target.id,
			amount,
			element,
			multiplier,
			...(abilityId ? { abilityId } : {}),
		},
	];
	if (!isCombatantAlive(target)) {
		events.push({ type: "combatant.defeated", combatantId: target.id });
	}
	return events;
};

const applyHeal = (
	actor: BattleCombatant,
	target: BattleCombatant,
	powerPercent: number,
	abilityId: string,
): BattleEvent[] => {
	const amount = Math.min(
		target.maxHp - target.hp,
		Math.max(
			1,
			Math.floor((modifiedStat(actor, "attack") * powerPercent) / 100),
		),
	);
	if (amount <= 0) return [];
	target.hp += amount;
	return [
		{
			type: "action.heal",
			actorId: actor.id,
			targetId: target.id,
			amount,
			abilityId,
		},
	];
};

const stableRoll = (
	state: BattleState,
	actor: BattleCombatant,
	target: BattleCombatant,
	ability: AbilityDefinition,
): number => {
	let hash = state.elapsedMs + actor.turnsTaken * 977;
	for (const value of `${actor.id}:${target.id}:${ability.id}`) {
		hash = Math.imul(hash ^ value.charCodeAt(0), 16_777_619);
	}
	return (hash >>> 0) / 0x1_0000_0000;
};

const applyStatus = (
	state: BattleState,
	actor: BattleCombatant,
	target: BattleCombatant,
	ability: AbilityDefinition,
): BattleEvent[] => {
	const status = ability.statusEffect;
	if (
		!status ||
		stableRoll(state, actor, target, ability) >= (ability.statusChance ?? 1)
	) {
		return [];
	}
	const nextStatus = { ...status, turnsRemaining: status.durationTurns };
	const existingIndex = target.statuses.findIndex(({ id }) => id === status.id);
	if (existingIndex >= 0) target.statuses[existingIndex] = nextStatus;
	else target.statuses.push(nextStatus);
	return [
		{
			type: "status.applied",
			actorId: actor.id,
			targetId: target.id,
			statusId: status.id,
		},
	];
};

const finishBattleIfNeeded = (state: BattleState): BattleEvent[] => {
	if (!state.enemies.some(isCombatantAlive)) {
		state.phase = "victory";
		state.activeActorId = null;
		return [{ type: "battle.ended", result: "victory" }];
	}
	if (!state.party.some(isCombatantAlive)) {
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
				isCombatantAlive(combatant) &&
				combatant.actionGauge >= ACTION_GAUGE_MAX,
		)
		.sort(
			(left, right) =>
				modifiedStat(right, "speed") - modifiedStat(left, "speed") ||
				left.id.localeCompare(right.id),
		);

const selectLowestHp = (
	combatants: BattleCombatant[],
): BattleCombatant | undefined =>
	combatants
		.filter(isCombatantAlive)
		.sort(
			(left, right) =>
				left.hp / left.maxHp - right.hp / right.maxHp ||
				left.id.localeCompare(right.id),
		)[0];

const targetCandidates = (
	state: BattleState,
	actor: BattleCombatant,
	targetRule: AbilityDefinition["target"],
): BattleCombatant[] => {
	const allies = actor.side === "party" ? state.party : state.enemies;
	const opponents = actor.side === "party" ? state.enemies : state.party;
	if (targetRule === "self") return isCombatantAlive(actor) ? [actor] : [];
	if (targetRule.startsWith("ally")) return allies.filter(isCombatantAlive);
	return opponents.filter(isCombatantAlive);
};

const resolveTargets = (
	state: BattleState,
	actor: BattleCombatant,
	ability: AbilityDefinition,
	targetId: string,
): BattleCombatant[] => {
	const candidates = targetCandidates(state, actor, ability.target);
	if (ability.target.endsWith("all")) return candidates;
	const target =
		ability.target === "self"
			? actor
			: candidates.find((candidate) => candidate.id === targetId);
	if (!target) {
		throw new BattleRuleError(
			"The selected target is unavailable for this ability.",
		);
	}
	return [target];
};

const executeAbility = (
	state: BattleState,
	actor: BattleCombatant,
	ability: AbilityDefinition,
	targetId: string,
): BattleEvent[] => {
	if (actor.mp < ability.mpCost) {
		throw new BattleRuleError("The actor does not have enough MP.");
	}
	const targets = resolveTargets(state, actor, ability, targetId);
	actor.mp -= ability.mpCost;
	const events: BattleEvent[] = [];
	if (ability.mpCost > 0) {
		events.push({
			type: "resource.spent",
			actorId: actor.id,
			amount: ability.mpCost,
			resource: "mp",
		});
	}
	for (const target of targets) {
		if (ability.kind === "damage") {
			events.push(
				...applyDamage(
					actor,
					target,
					ability.powerPercent,
					ability.element,
					ability.id,
				),
			);
		} else if (ability.kind === "heal") {
			events.push(
				...applyHeal(actor, target, ability.powerPercent, ability.id),
			);
		}
		if (ability.statusEffect && isCombatantAlive(target)) {
			events.push(...applyStatus(state, actor, target, ability));
		}
	}
	return events;
};

const finishTurn = (
	actor: BattleCombatant,
	preserveDefending = false,
): BattleEvent[] => {
	const events: BattleEvent[] = [];
	actor.turnsTaken += 1;
	const remaining = [];
	for (const status of actor.statuses) {
		if (status.damagePercentMaxHp > 0 && isCombatantAlive(actor)) {
			const amount = Math.max(
				1,
				Math.floor((actor.maxHp * status.damagePercentMaxHp) / 100),
			);
			actor.hp = Math.max(0, actor.hp - amount);
			events.push({
				type: "status.damage",
				combatantId: actor.id,
				statusId: status.id,
				amount,
			});
			if (!isCombatantAlive(actor)) {
				events.push({ type: "combatant.defeated", combatantId: actor.id });
			}
		}
		const turnsRemaining = status.turnsRemaining - 1;
		if (turnsRemaining > 0 && isCombatantAlive(actor)) {
			remaining.push({ ...status, turnsRemaining });
		} else {
			events.push({
				type: "status.expired",
				combatantId: actor.id,
				statusId: status.id,
			});
		}
	}
	actor.statuses = remaining;
	actor.actionGauge = 0;
	if (!preserveDefending) actor.defending = false;
	return events;
};

const chooseEnemyAbility = (
	enemy: BattleCombatant,
): AbilityDefinition | null => {
	const patternId = enemy.aiPattern[enemy.turnsTaken % enemy.aiPattern.length];
	const planned = enemy.abilities.find(({ id }) => id === patternId);
	if (planned && enemy.mp >= planned.mpCost) return planned;
	return null;
};

const executeEnemyTurn = (
	state: BattleState,
	enemy: BattleCombatant,
): BattleEvent[] => {
	const ability = chooseEnemyAbility(enemy);
	let events: BattleEvent[];
	if (ability) {
		const candidates = targetCandidates(state, enemy, ability.target);
		const target =
			ability.target === "self" ? enemy : (selectLowestHp(candidates) ?? enemy);
		events = executeAbility(state, enemy, ability, target.id);
	} else {
		const target = selectLowestHp(state.party);
		events = target ? applyDamage(enemy, target, 100, "physical") : [];
	}
	events.push(...finishTurn(enemy));
	events.push(...finishBattleIfNeeded(state));
	return events;
};

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
		if (!isCombatantAlive(combatant)) continue;
		combatant.actionGauge = Math.min(
			ACTION_GAUGE_MAX,
			combatant.actionGauge +
				(modifiedStat(combatant, "speed") *
					GAUGE_PER_SPEED_PER_SECOND *
					deltaMs) /
					1_000,
		);
	}

	const events: BattleEvent[] = [];
	const ready = readyCombatants(next)[0];
	if (!ready) return { state: next, events };
	if (ready.side === "party") {
		next.phase = "awaiting-command";
		next.activeActorId = ready.id;
		events.push({ type: "gauge.ready", actorId: ready.id });
		return { state: next, events };
	}

	events.push(...executeEnemyTurn(next, ready));

	return { state: next, events };
}

const applyItem = (
	state: BattleState,
	actor: BattleCombatant,
	targetId: string,
	itemId: string,
): BattleEvent[] => {
	const item = state.items.find((candidate) => candidate.id === itemId);
	if (!item || item.count <= 0 || item.effect === "none") {
		throw new BattleRuleError("The selected item is unavailable.");
	}
	const target = state.party.find((candidate) => candidate.id === targetId);
	if (!target)
		throw new BattleRuleError("The selected item target is unavailable.");
	let amount = 0;
	if (
		item.effect === "restore-hp" &&
		target.hp > 0 &&
		target.hp < target.maxHp
	) {
		amount = Math.min(item.power, target.maxHp - target.hp);
		target.hp += amount;
	} else if (
		item.effect === "restore-mp" &&
		target.hp > 0 &&
		target.mp < target.maxMp
	) {
		amount = Math.min(item.power, target.maxMp - target.mp);
		target.mp += amount;
	} else if (item.effect === "revive" && target.hp === 0) {
		amount = Math.max(1, Math.floor((target.maxHp * item.power) / 100));
		target.hp = amount;
	} else if (item.effect === "cure-status") {
		const before = target.statuses.length;
		target.statuses = target.statuses.filter(
			(status) => !item.statusIds.includes(status.id),
		);
		amount = before - target.statuses.length;
	} else {
		throw new BattleRuleError(
			"The selected item has no effect on that target.",
		);
	}
	item.count -= 1;
	return [
		{
			type: "item.used",
			actorId: actor.id,
			targetId: target.id,
			itemId: item.id,
			effect: item.effect,
			amount,
		},
	];
};

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
	if (actor?.side !== "party" || !isCombatantAlive(actor)) {
		throw new BattleRuleError("The acting party member is unavailable.");
	}

	const events: BattleEvent[] = [];
	if (command.type === "escape") {
		if (!next.canEscape)
			throw new BattleRuleError("This battle cannot be escaped.");
		next.phase = "escaped";
		next.activeActorId = null;
		events.push({ type: "battle.ended", result: "escaped" });
		return { state: next, events };
	}
	if (command.type === "defend") {
		actor.defending = true;
		events.push({ type: "action.defend", actorId: actor.id });
		events.push(...finishTurn(actor, true));
	} else if (command.type === "item") {
		events.push(...applyItem(next, actor, command.targetId, command.itemId));
		events.push(...finishTurn(actor));
	} else if (command.type === "ability") {
		const ability = actor.abilities.find(({ id }) => id === command.abilityId);
		if (!ability) {
			throw new BattleRuleError("The actor cannot use the selected ability.");
		}
		events.push(...executeAbility(next, actor, ability, command.targetId));
		events.push(...finishTurn(actor));
	} else {
		const target = getCombatant(next, command.targetId);
		if (target?.side !== "enemy" || !isCombatantAlive(target)) {
			throw new BattleRuleError("The selected enemy target is unavailable.");
		}
		events.push(...applyDamage(actor, target, 100, "physical"));
		events.push(...finishTurn(actor));
	}

	next.activeActorId = null;
	next.phase = "running";
	events.push(...finishBattleIfNeeded(next));
	return { state: next, events };
}

export type BattleSimulationResult = {
	state: BattleState;
	commands: number;
	ticks: number;
	stalled: boolean;
};

export function simulateBattle(
	initialState: BattleState,
	maxTicks = 20_000,
): BattleSimulationResult {
	let state = cloneState(initialState);
	let commands = 0;
	let ticks = 0;
	while (
		(state.phase === "running" || state.phase === "awaiting-command") &&
		ticks < maxTicks
	) {
		if (state.phase === "running") {
			state = advanceBattle(state, 100).state;
			ticks += 1;
			continue;
		}
		const actor = state.party.find(({ id }) => id === state.activeActorId);
		const target = selectLowestHp(state.enemies);
		if (!actor || !target) break;
		const usableAbility = actor.abilities.find(
			(ability) =>
				ability.kind === "damage" &&
				ability.target === "enemy-single" &&
				actor.mp >= ability.mpCost,
		);
		state = applyBattleCommand(
			state,
			usableAbility
				? {
						type: "ability",
						actorId: actor.id,
						targetId: target.id,
						abilityId: usableAbility.id,
					}
				: { type: "attack", actorId: actor.id, targetId: target.id },
		).state;
		commands += 1;
	}
	return {
		state,
		commands,
		ticks,
		stalled: state.phase === "running" || state.phase === "awaiting-command",
	};
}
