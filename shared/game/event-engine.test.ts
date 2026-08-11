import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../scripts/validate-game-content";
import { eventDefinitionSchema } from "./content";
import {
	advanceEvent,
	EVENT_EXECUTION_BUDGET,
	EventRuntimeError,
} from "./event-engine";

const registry = validateGameContentDirectory();
const story = () => ({
	flags: {} as Record<string, boolean>,
	relationships: { "mira:sol": 0 },
});

describe("event engine", () => {
	it("advances Signal Ruins dialogue into a resumable battle operation", () => {
		const definition = registry.getEvent("signal-ruins-contact");
		const started = advanceEvent(definition, null, story(), { type: "start" });
		expect(started.event).toMatchObject({
			status: "awaiting-confirm",
			visibleLine: { speakerId: "mira" },
		});
		expect(started.events.map(({ type }) => type)).toEqual([
			"event.started",
			"dialogue.presented",
		]);

		const second = advanceEvent(definition, started.event, story(), {
			type: "advance",
		});
		expect(second.event?.visibleLine?.speakerId).toBe("lune");
		const battle = advanceEvent(definition, second.event, story(), {
			type: "advance",
		});
		expect(battle.operations).toEqual([
			{ type: "battle.start", encounterId: "signal-ruins-encounter" },
		]);
		expect(battle.event).toMatchObject({
			status: "running",
			nodeId: "mark-ruins-cleared",
		});

		const resumed = advanceEvent(definition, battle.event, story(), {
			type: "resume",
		});
		expect(resumed.event).toBeNull();
		expect(resumed.operations).toEqual([
			{ type: "flag.set", flagId: "signal-ruins-cleared", value: true },
			{ type: "checkpoint.reach", checkpointId: "signal-core" },
			{ type: "event.complete" },
		]);
	});

	it("filters choices and produces branch-specific persistent operations", () => {
		const definition = registry.getEvent("relay-camp-council");
		let transition = advanceEvent(definition, null, story(), { type: "start" });
		transition = advanceEvent(definition, transition.event, story(), {
			type: "advance",
		});
		transition = advanceEvent(definition, transition.event, story(), {
			type: "advance",
		});
		expect(transition.event?.choices).toEqual([
			{ id: "support-mira", text: "Secure the relay with Mira." },
			{ id: "support-sol", text: "Follow the echo with Sol." },
		]);

		const selected = advanceEvent(definition, transition.event, story(), {
			type: "choose",
			choiceId: "support-sol",
		});
		expect(selected.event).toBeNull();
		expect(selected.operations).toEqual([
			{ type: "flag.set", flagId: "relay-plan-sol", value: true },
			{
				type: "relationship.adjust",
				relationshipId: "mira:sol",
				amount: -5,
			},
			{
				type: "flag.set",
				flagId: "relay-council-complete",
				value: true,
			},
			{ type: "checkpoint.reach", checkpointId: "relay-center" },
			{ type: "event.complete" },
		]);
		expect(selected.events[0]).toMatchObject({
			type: "choice.selected",
			choiceId: "support-sol",
		});

		const emptyRelationships = { flags: {}, relationships: {} };
		let mira = advanceEvent(definition, null, emptyRelationships, {
			type: "start",
		});
		mira = advanceEvent(definition, mira.event, emptyRelationships, {
			type: "advance",
		});
		mira = advanceEvent(definition, mira.event, emptyRelationships, {
			type: "advance",
		});
		expect(
			advanceEvent(definition, mira.event, emptyRelationships, {
				type: "choose",
				choiceId: "support-mira",
			}).operations,
		).toContainEqual({
			type: "relationship.adjust",
			relationshipId: "mira:sol",
			amount: 10,
		});
	});

	it("uses story conditions to resume the matching reaction", () => {
		const definition = registry.getEvent("relay-camp-reaction");
		const mira = advanceEvent(
			definition,
			null,
			{
				flags: { "relay-plan-mira": true },
				relationships: {},
			},
			{ type: "start" },
		);
		expect(mira.event?.visibleLine?.speakerId).toBe("mira");

		const sol = advanceEvent(
			definition,
			null,
			{
				flags: { "relay-plan-sol": true },
				relationships: {},
			},
			{ type: "start" },
		);
		expect(sol.event?.visibleLine?.speakerId).toBe("sol");
	});

	it("runs wait and actor presentation nodes before a map transition", () => {
		const definition = eventDefinitionSchema.parse({
			id: "presentation-test",
			title: "Presentation",
			presentation: {
				backgroundAssetId: "signal-ruins-field",
				actors: [{ actorId: "mira", slot: "left", expression: "neutral" }],
			},
			entryNodeId: "wait",
			nodes: [
				{ id: "wait", type: "wait", durationMs: 25, nextNodeId: "move" },
				{
					id: "move",
					type: "actor.move",
					actorId: "mira",
					slot: "right",
					nextNodeId: "expression",
				},
				{
					id: "expression",
					type: "actor.expression",
					actorId: "mira",
					expression: "smile",
					nextNodeId: "enter-map",
				},
				{
					id: "enter-map",
					type: "map.enter",
					mapId: "relay-camp",
					entranceId: "ruins-gate",
				},
			],
		});
		const transition = advanceEvent(definition, null, story(), {
			type: "start",
		});
		expect(transition.event).toBeNull();
		expect(transition.operations).toEqual([
			{ type: "map.enter", mapId: "relay-camp", entranceId: "ruins-gate" },
		]);
		expect(transition.events.map(({ type }) => type)).toEqual([
			"event.started",
			"event.waited",
			"event.actor.moved",
			"event.actor.expression.changed",
			"event.completed",
		]);
	});

	it("rejects stale inputs, missing actors, terminal skips, and loops", () => {
		const definition = registry.getEvent("signal-ruins-contact");
		expect(() =>
			advanceEvent(definition, null, story(), { type: "advance" }),
		).toThrow(EventRuntimeError);
		const started = advanceEvent(definition, null, story(), { type: "start" });
		expect(() =>
			advanceEvent(definition, started.event, story(), {
				type: "choose",
				choiceId: "hidden",
			}),
		).toThrow("visible choices");

		const choiceDefinition = registry.getEvent("relay-camp-council");
		let choice = advanceEvent(choiceDefinition, null, story(), { type: "start" });
		choice = advanceEvent(choiceDefinition, choice.event, story(), {
			type: "advance",
		});
		choice = advanceEvent(choiceDefinition, choice.event, story(), {
			type: "advance",
		});
		expect(() =>
			advanceEvent(choiceDefinition, choice.event, story(), {
				type: "choose",
				choiceId: "hidden",
			}),
		).toThrow("not currently available");

		const missingActor = eventDefinitionSchema.parse({
			id: "missing-actor",
			title: "Missing",
			presentation: { backgroundAssetId: "asset", actors: [] },
			entryNodeId: "move",
			nodes: [
				{
					id: "move",
					type: "actor.move",
					actorId: "mira",
					slot: "right",
					nextNodeId: "end",
				},
				{ id: "end", type: "end" },
			],
		});
		expect(() =>
			advanceEvent(missingActor, null, story(), { type: "start" }),
		).toThrow("not present");

		const terminalSkip = eventDefinitionSchema.parse({
			id: "terminal-skip",
			title: "Skip",
			presentation: { backgroundAssetId: "asset", actors: [] },
			entryNodeId: "end",
			nodes: [
				{
					id: "end",
					type: "end",
					condition: { type: "flag.equals", flagId: "never", value: true },
				},
			],
		});
		expect(() =>
			advanceEvent(terminalSkip, null, story(), { type: "start" }),
		).toThrow("no fallback");

		const loop = eventDefinitionSchema.parse({
			id: "loop",
			title: "Loop",
			presentation: { backgroundAssetId: "asset", actors: [] },
			entryNodeId: "wait",
			nodes: [
				{ id: "wait", type: "wait", durationMs: 0, nextNodeId: "wait" },
			],
		});
		expect(() => advanceEvent(loop, null, story(), { type: "start" })).toThrow(
			`${EVENT_EXECUTION_BUDGET}-node`,
		);
	});
});
