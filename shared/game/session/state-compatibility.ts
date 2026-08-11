import type {
	EventDefinitionV1,
	GameContentRegistry,
	MapDefinitionV1,
} from "../content";
import { type GameState, getGameStateInvariantIssues } from "../model";
import { GameSessionError } from "./errors";

export function assertGameStateCompatible(
	state: GameState,
	content: GameContentRegistry,
): void {
	if (state.contentVersion !== content.contentVersion) {
		throw new GameSessionError(
			"incompatible-content",
			`Save content '${state.contentVersion}' is incompatible with '${content.contentVersion}'.`,
		);
	}
	const invariantIssue = getGameStateInvariantIssues(state)[0];
	if (invariantIssue) {
		throw new GameSessionError("invalid-state", invariantIssue.message);
	}
	let map: MapDefinitionV1;
	try {
		map = content.getMap(state.location.mapId);
	} catch {
		throw new GameSessionError(
			"invalid-content-reference",
			`State references unknown map '${state.location.mapId}'.`,
		);
	}
	if (!map.entrances.some(({ id }) => id === state.location.entranceId)) {
		throw new GameSessionError(
			"invalid-content-reference",
			`State references unknown entrance '${state.location.entranceId}'.`,
		);
	}
	if (!map.checkpoints.some(({ id }) => id === state.location.checkpointId)) {
		throw new GameSessionError(
			"invalid-content-reference",
			`State references unknown checkpoint '${state.location.checkpointId}'.`,
		);
	}
	if (state.field.partyPositions.length !== state.party.members.length) {
		throw new GameSessionError(
			"invalid-state",
			"Field positions must match the current party size.",
		);
	}
	for (const position of state.field.partyPositions) {
		if (
			!Number.isInteger(position.x) ||
			!Number.isInteger(position.y) ||
			position.x < 0 ||
			position.y < 0 ||
			position.x >= map.width ||
			position.y >= map.height ||
			content.isCollision(map.id, position.x, position.y)
		) {
			throw new GameSessionError(
				"invalid-state",
				`Field position '${position.x},${position.y}' is not walkable on map '${map.id}'.`,
			);
		}
	}
	for (const member of state.party.members) {
		if (!content.actorsById[member.id]) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Party member '${member.id}' has no content actor.`,
			);
		}
		if (!content.charactersById[member.id]) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Party member '${member.id}' has no progression definition.`,
			);
		}
		for (const ability of member.abilities) {
			if (!content.abilitiesById[ability.id]) {
				throw new GameSessionError(
					"invalid-content-reference",
					`Party member '${member.id}' references unknown ability '${ability.id}'.`,
				);
			}
		}
	}
	for (const itemId of Object.keys(state.party.inventory)) {
		if (!content.itemsById[itemId]) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Inventory references unknown item '${itemId}'.`,
			);
		}
	}
	for (const equipmentId of Object.keys(state.party.equipmentInventory)) {
		if (!content.equipmentById[equipmentId]) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Equipment inventory references unknown equipment '${equipmentId}'.`,
			);
		}
	}
	for (const member of state.party.members) {
		const loadout = state.party.equipment[member.id];
		if (!loadout) {
			throw new GameSessionError(
				"invalid-state",
				`Party member '${member.id}' has no equipment loadout.`,
			);
		}
		for (const [slot, equipmentId] of Object.entries(loadout)) {
			if (!equipmentId) continue;
			const definition = content.equipmentById[equipmentId];
			if (
				!definition ||
				definition.slot !== slot ||
				!definition.actorIds.includes(member.id)
			) {
				throw new GameSessionError(
					"invalid-content-reference",
					`Party member '${member.id}' has invalid equipment '${equipmentId}'.`,
				);
			}
		}
	}
	if (state.field.pendingTriggerId) {
		const trigger = map.triggers.find(
			(candidate) => candidate.id === state.field.pendingTriggerId,
		);
		const leader = state.field.partyPositions[0];
		if (
			!trigger ||
			!leader ||
			trigger.position.x !== leader.x ||
			trigger.position.y !== leader.y
		) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Pending trigger '${state.field.pendingTriggerId}' is not valid at the party position.`,
			);
		}
	}
	if (state.battle && !content.hasEncounter(state.battle.id)) {
		throw new GameSessionError(
			"invalid-content-reference",
			`State references unknown encounter '${state.battle.id}'.`,
		);
	}
	if (state.event) {
		let definition: EventDefinitionV1;
		try {
			definition = content.getEvent(state.event.eventId);
		} catch {
			throw new GameSessionError(
				"invalid-content-reference",
				`State references unknown event '${state.event.eventId}'.`,
			);
		}
		const node = definition.nodes.find(({ id }) => id === state.event?.nodeId);
		if (!node) {
			throw new GameSessionError(
				"invalid-content-reference",
				`State references unknown event node '${state.event.nodeId}'.`,
			);
		}
		if (
			(state.event.status === "awaiting-confirm" && node.type !== "line") ||
			(state.event.status === "awaiting-choice" && node.type !== "choice")
		) {
			throw new GameSessionError(
				"invalid-state",
				`Event '${state.event.eventId}' has an invalid runtime status for node '${node.id}'.`,
			);
		}
		const expectedActorIds = new Set(
			definition.presentation.actors.map((actor) => actor.actorId),
		);
		const savedActorIds = new Set(
			state.event.actors.map((actor) => actor.actorId),
		);
		if (
			state.event.actors.length !== expectedActorIds.size ||
			expectedActorIds.size !== savedActorIds.size ||
			[...expectedActorIds].some((actorId) => !savedActorIds.has(actorId))
		) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Event '${state.event.eventId}' actor state is incompatible with its presentation.`,
			);
		}
		if (
			state.event.visibleLine &&
			!content.actorsById[state.event.visibleLine.speakerId]
		) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Event '${state.event.eventId}' references unknown speaker '${state.event.visibleLine.speakerId}'.`,
			);
		}
		if (
			node.type === "choice" &&
			state.event.choices.some(
				(choice) => !node.choices.some(({ id }) => id === choice.id),
			)
		) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Event '${state.event.eventId}' contains an unknown saved choice.`,
			);
		}
	}
}
