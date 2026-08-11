import type { MapTriggerV1 } from "@shared/game";
import { describe, expect, it } from "vitest";
import { getPendingFieldTriggerAction } from "./field-transition";

const triggers = [
	{
		id: "relay-gate",
		kind: "map",
		position: { x: 4, y: 2 },
		targetId: "relay-camp",
		targetEntranceId: "from-ruins",
	},
	{
		id: "restoring-spring",
		kind: "recovery",
		position: { x: 2, y: 2 },
		targetId: "party",
	},
] satisfies MapTriggerV1[];

describe("field transition recovery", () => {
	it("does nothing when there is no pending trigger", () => {
		expect(
			getPendingFieldTriggerAction(null, triggers, () => false),
		).toBeNull();
	});

	it("loads a missing destination map before resolving its trigger", () => {
		expect(
			getPendingFieldTriggerAction("relay-gate", triggers, () => false),
		).toEqual({ type: "load-map", mapId: "relay-camp" });
	});

	it("resolves loaded map and non-map triggers immediately", () => {
		expect(
			getPendingFieldTriggerAction("relay-gate", triggers, () => true),
		).toEqual({ type: "resolve" });
		expect(
			getPendingFieldTriggerAction(
				"restoring-spring",
				triggers,
				() => false,
			),
		).toEqual({ type: "resolve" });
	});

	it("reports an invalid pending trigger instead of silently deadlocking", () => {
		expect(
			getPendingFieldTriggerAction("missing-trigger", triggers, () => false),
		).toEqual({ type: "invalid", triggerId: "missing-trigger" });
	});
});
