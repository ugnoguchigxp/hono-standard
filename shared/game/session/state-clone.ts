import type {
	ActiveEventState,
	BattleState,
	CharacterState,
	GameState,
} from "../model";

const cloneCharacter = (character: CharacterState): CharacterState => ({
	...character,
	ability: {
		...character.ability,
		...(character.ability.statusEffect
			? { statusEffect: { ...character.ability.statusEffect } }
			: {}),
	},
	abilities: character.abilities.map((ability) => ({
		...ability,
		...(ability.statusEffect
			? { statusEffect: { ...ability.statusEffect } }
			: {}),
	})),
});

export const cloneBattleState = (
	battle: BattleState | null,
): BattleState | null =>
	battle
		? {
				...battle,
				party: battle.party.map((member) => ({
					...cloneCharacter(member),
					side: member.side,
					actionGauge: member.actionGauge,
					defending: member.defending,
					statuses: member.statuses.map((status) => ({ ...status })),
					elementMultipliers: { ...member.elementMultipliers },
					aiPattern: [...member.aiPattern],
					turnsTaken: member.turnsTaken,
				})),
				enemies: battle.enemies.map((enemy) => ({
					...cloneCharacter(enemy),
					side: enemy.side,
					actionGauge: enemy.actionGauge,
					defending: enemy.defending,
					statuses: enemy.statuses.map((status) => ({ ...status })),
					elementMultipliers: { ...enemy.elementMultipliers },
					aiPattern: [...enemy.aiPattern],
					turnsTaken: enemy.turnsTaken,
				})),
				items: battle.items.map((item) => ({
					...item,
					statusIds: [...item.statusIds],
				})),
			}
		: null;

const cloneEventState = (
	event: ActiveEventState | null,
): ActiveEventState | null =>
	event
		? {
				...event,
				visibleLine: event.visibleLine ? { ...event.visibleLine } : null,
				choices: event.choices.map((choice) => ({ ...choice })),
				actors: event.actors.map((actor) => ({ ...actor })),
			}
		: null;

export const cloneGameState = (state: GameState): GameState => ({
	...state,
	rng: { ...state.rng },
	location: { ...state.location },
	field: {
		...state.field,
		partyPositions: state.field.partyPositions.map((position) => ({
			...position,
		})),
	},
	event: cloneEventState(state.event),
	party: {
		members: state.party.members.map(cloneCharacter),
		inventory: { ...state.party.inventory },
		equipmentInventory: { ...state.party.equipmentInventory },
		equipment: Object.fromEntries(
			Object.entries(state.party.equipment).map(([actorId, equipment]) => [
				actorId,
				{ ...equipment },
			]),
		),
	},
	story: {
		...state.story,
		flags: Object.assign(Object.create(null), state.story.flags),
		relationships: Object.assign(
			Object.create(null),
			state.story.relationships,
		),
	},
	battle: cloneBattleState(state.battle),
});
