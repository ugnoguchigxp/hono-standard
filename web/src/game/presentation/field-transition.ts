import type { MapTriggerV1 } from "@shared/game";

export type PendingFieldTriggerAction =
	| { type: "load-map"; mapId: string }
	| { type: "resolve" }
	| { type: "invalid"; triggerId: string }
	| null;

export function getPendingFieldTriggerAction(
	pendingTriggerId: string | null,
	triggers: readonly MapTriggerV1[],
	isMapLoaded: (mapId: string) => boolean,
): PendingFieldTriggerAction {
	if (!pendingTriggerId) return null;
	const trigger = triggers.find(({ id }) => id === pendingTriggerId);
	if (!trigger) return { type: "invalid", triggerId: pendingTriggerId };
	if (trigger.kind === "map" && !isMapLoaded(trigger.targetId)) {
		return { type: "load-map", mapId: trigger.targetId };
	}
	return { type: "resolve" };
}
