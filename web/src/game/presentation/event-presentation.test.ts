import type { GameSessionEvent } from "@shared/game";
import { describe, expect, it } from "vitest";
import { getEventPresentationSteps } from "./event-presentation";

const envelope = (event: GameSessionEvent) => ({ event });

describe("event presentation", () => {
	it("keeps waits, actor movement, and expressions in semantic order", () => {
		expect(
			getEventPresentationSteps([
				envelope({
					type: "event.actor.moved",
					eventId: "scene",
					actorId: "mira",
					slot: "center",
				}),
				envelope({ type: "event.waited", eventId: "scene", durationMs: 240 }),
				envelope({
					type: "event.actor.expression.changed",
					eventId: "scene",
					actorId: "mira",
					expression: "focused",
				}),
			]),
		).toEqual([
			{ type: "actor.move", actorId: "mira", slot: "center" },
			{ type: "wait", durationMs: 240 },
			{ type: "actor.expression", actorId: "mira", expression: "focused" },
		]);
	});

	it("does not turn persistent or dialogue events into duplicate animation", () => {
		expect(
			getEventPresentationSteps([
				envelope({
					type: "story.flag.changed",
					flagId: "opened",
					previousValue: null,
					value: true,
				}),
				envelope({
					type: "dialogue.presented",
					eventId: "scene",
					speakerId: "mira",
					text: "Ready.",
				}),
			]),
		).toEqual([]);
	});
});
