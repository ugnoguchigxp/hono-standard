import type { EventDefinitionV1 } from "./content";
import { evaluateContentCondition } from "./content";
import type { ActiveEventState, GameSessionEvent, StoryState } from "./model";

export const EVENT_EXECUTION_BUDGET = 64;

export class EventRuntimeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EventRuntimeError";
	}
}

export type EventOperation =
	| { type: "flag.set"; flagId: string; value: boolean }
	| {
			type: "relationship.adjust";
			relationshipId: string;
			amount: number;
	  }
	| { type: "battle.start"; encounterId: string }
	| { type: "map.enter"; mapId: string; entranceId: string }
	| { type: "checkpoint.reach"; checkpointId: string }
	| { type: "event.complete" };

export type EventEngineTransition = {
	event: ActiveEventState | null;
	operations: EventOperation[];
	events: GameSessionEvent[];
};

type EventInput =
	| { type: "start" }
	| { type: "advance" }
	| { type: "choose"; choiceId: string }
	| { type: "resume" };

const cloneActiveEvent = (event: ActiveEventState): ActiveEventState => ({
	...event,
	visibleLine: event.visibleLine ? { ...event.visibleLine } : null,
	choices: event.choices.map((choice) => ({ ...choice })),
	actors: event.actors.map((actor) => ({ ...actor })),
});

const cloneStory = (
	story: Pick<StoryState, "flags" | "relationships">,
): Pick<StoryState, "flags" | "relationships"> => ({
	flags: Object.assign(Object.create(null), story.flags),
	relationships: Object.assign(Object.create(null), story.relationships),
});

export function advanceEvent(
	definition: EventDefinitionV1,
	activeEvent: ActiveEventState | null,
	story: Pick<StoryState, "flags" | "relationships">,
	input: EventInput,
): EventEngineTransition {
	const events: GameSessionEvent[] = [];
	const operations: EventOperation[] = [];
	const localStory = cloneStory(story);
	let active: ActiveEventState;

	if (input.type === "start") {
		if (activeEvent) throw new EventRuntimeError("An event is already active.");
		active = {
			eventId: definition.id,
			nodeId: definition.entryNodeId,
			status: "running",
			visibleLine: null,
			choices: [],
			actors: definition.presentation.actors.map((actor) => ({ ...actor })),
		};
		events.push({ type: "event.started", eventId: definition.id });
	} else {
		if (!activeEvent || activeEvent.eventId !== definition.id) {
			throw new EventRuntimeError(
				`Event '${definition.id}' is not the active event.`,
			);
		}
		active = cloneActiveEvent(activeEvent);
		const current = definition.nodes.find((node) => node.id === active.nodeId);
		if (!current) {
			throw new EventRuntimeError(
				`Event '${definition.id}' has no node '${active.nodeId}'.`,
			);
		}
		if (input.type === "advance") {
			if (active.status !== "awaiting-confirm" || current.type !== "line") {
				throw new EventRuntimeError(
					"Event advance requires a visible dialogue line.",
				);
			}
			active.nodeId = current.nextNodeId;
			active.status = "running";
			active.visibleLine = null;
			active.choices = [];
		} else if (input.type === "choose") {
			if (active.status !== "awaiting-choice" || current.type !== "choice") {
				throw new EventRuntimeError("Event choice requires visible choices.");
			}
			const visibleChoice = active.choices.find(
				(choice) => choice.id === input.choiceId,
			);
			const definitionChoice = current.choices.find(
				(choice) => choice.id === input.choiceId,
			);
			if (!visibleChoice || !definitionChoice) {
				throw new EventRuntimeError(
					`Choice '${input.choiceId}' is not currently available.`,
				);
			}
			events.push({
				type: "choice.selected",
				eventId: definition.id,
				choiceId: input.choiceId,
			});
			active.nodeId = definitionChoice.nextNodeId;
			active.status = "running";
			active.visibleLine = null;
			active.choices = [];
		} else if (active.status !== "running") {
			throw new EventRuntimeError(
				"Only a running event can resume automatically.",
			);
		}
	}

	for (let step = 0; step < EVENT_EXECUTION_BUDGET; step += 1) {
		const node = definition.nodes.find(
			(candidate) => candidate.id === active.nodeId,
		);
		if (!node) {
			throw new EventRuntimeError(
				`Event '${definition.id}' has no node '${active.nodeId}'.`,
			);
		}
		if (!evaluateContentCondition(node.condition, localStory)) {
			if (
				node.type === "map.enter" ||
				node.type === "end" ||
				node.type === "choice"
			) {
				throw new EventRuntimeError(
					`Conditional terminal node '${node.id}' has no fallback transition.`,
				);
			}
			active.nodeId = node.nextNodeId;
			continue;
		}

		switch (node.type) {
			case "line":
				active.status = "awaiting-confirm";
				active.visibleLine = { speakerId: node.speakerId, text: node.text };
				active.choices = [];
				events.push({
					type: "dialogue.presented",
					eventId: definition.id,
					speakerId: node.speakerId,
					text: node.text,
				});
				return { event: active, operations, events };
			case "choice": {
				const choices = node.choices
					.filter((choice) =>
						evaluateContentCondition(choice.condition, localStory),
					)
					.map(({ id, text }) => ({ id, text }));
				if (choices.length === 0) {
					throw new EventRuntimeError(
						`Choice node '${node.id}' has no available choices.`,
					);
				}
				active.status = "awaiting-choice";
				active.visibleLine = { speakerId: "narrator", text: node.prompt };
				active.choices = choices;
				events.push({
					type: "choice.presented",
					eventId: definition.id,
					choices: choices.map((choice) => ({ ...choice })),
				});
				return { event: active, operations, events };
			}
			case "wait":
				events.push({
					type: "event.waited",
					eventId: definition.id,
					durationMs: node.durationMs,
				});
				active.nodeId = node.nextNodeId;
				break;
			case "actor.move": {
				const actor = active.actors.find(
					(candidate) => candidate.actorId === node.actorId,
				);
				if (!actor) {
					throw new EventRuntimeError(
						`Actor '${node.actorId}' is not present in event '${definition.id}'.`,
					);
				}
				actor.slot = node.slot;
				events.push({
					type: "event.actor.moved",
					eventId: definition.id,
					actorId: node.actorId,
					slot: node.slot,
				});
				active.nodeId = node.nextNodeId;
				break;
			}
			case "actor.expression": {
				const actor = active.actors.find(
					(candidate) => candidate.actorId === node.actorId,
				);
				if (!actor) {
					throw new EventRuntimeError(
						`Actor '${node.actorId}' is not present in event '${definition.id}'.`,
					);
				}
				actor.expression = node.expression;
				events.push({
					type: "event.actor.expression.changed",
					eventId: definition.id,
					actorId: node.actorId,
					expression: node.expression,
				});
				active.nodeId = node.nextNodeId;
				break;
			}
			case "flag.set":
				localStory.flags[node.flagId] = node.value;
				operations.push({
					type: "flag.set",
					flagId: node.flagId,
					value: node.value,
				});
				active.nodeId = node.nextNodeId;
				break;
			case "relationship.adjust": {
				const previousRelationship = Object.hasOwn(
					localStory.relationships,
					node.relationshipId,
				)
					? localStory.relationships[node.relationshipId]
					: 0;
				localStory.relationships[node.relationshipId] = Math.max(
					-100,
					Math.min(100, previousRelationship + node.amount),
				);
				operations.push({
					type: "relationship.adjust",
					relationshipId: node.relationshipId,
					amount: node.amount,
				});
				active.nodeId = node.nextNodeId;
				break;
			}
			case "battle.start":
				active.nodeId = node.nextNodeId;
				active.status = "running";
				operations.push({
					type: "battle.start",
					encounterId: node.encounterId,
				});
				return { event: active, operations, events };
			case "map.enter":
				operations.push({
					type: "map.enter",
					mapId: node.mapId,
					entranceId: node.entranceId,
				});
				events.push({ type: "event.completed", eventId: definition.id });
				return { event: null, operations, events };
			case "checkpoint.reach":
				operations.push({
					type: "checkpoint.reach",
					checkpointId: node.checkpointId,
				});
				active.nodeId = node.nextNodeId;
				break;
			case "end":
				operations.push({ type: "event.complete" });
				events.push({ type: "event.completed", eventId: definition.id });
				return { event: null, operations, events };
		}
	}

	throw new EventRuntimeError(
		`Event '${definition.id}' exceeded the ${EVENT_EXECUTION_BUDGET}-node execution budget.`,
	);
}
