import type {
	ActiveEventActorState,
	GameSessionEventEnvelope,
} from "@shared/game";

export type EventPresentationStep =
	| { type: "wait"; durationMs: number }
	| {
			type: "actor.move";
			actorId: string;
			slot: ActiveEventActorState["slot"];
	  }
	| { type: "actor.expression"; actorId: string; expression: string };

export function getEventPresentationSteps(
	events: readonly Pick<GameSessionEventEnvelope, "event">[],
): EventPresentationStep[] {
	const steps: EventPresentationStep[] = [];
	for (const { event } of events) {
		switch (event.type) {
			case "event.waited":
				steps.push({ type: "wait", durationMs: event.durationMs });
				break;
			case "event.actor.moved":
				steps.push({
					type: "actor.move",
					actorId: event.actorId,
					slot: event.slot,
				});
				break;
			case "event.actor.expression.changed":
				steps.push({
					type: "actor.expression",
					actorId: event.actorId,
					expression: event.expression,
				});
				break;
			default:
				break;
		}
	}
	return steps;
}
