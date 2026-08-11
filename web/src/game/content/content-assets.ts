import type {
	AssetDefinitionV1,
	GameContentRegistry,
	GameState,
} from "@shared/game";

export function getRequiredAssetIdsForMap(
	registry: GameContentRegistry,
	mapId: string,
): string[] {
	const map = registry.getMap(mapId);
	const ids = new Set([map.backgroundAssetId, map.battleBackgroundAssetId]);
	for (const trigger of map.triggers) {
		if (trigger.kind !== "event") continue;
		const event = registry.eventsById[trigger.targetId];
		if (event) ids.add(event.presentation.backgroundAssetId);
	}
	return [...ids];
}

export function getRequiredAssetsForState(
	registry: GameContentRegistry,
	state: Pick<GameState, "location" | "event">,
): AssetDefinitionV1[] {
	const ids = new Set(
		getRequiredAssetIdsForMap(registry, state.location.mapId),
	);
	if (state.event) {
		ids.add(
			registry.getEvent(state.event.eventId).presentation.backgroundAssetId,
		);
	}
	return [...ids].map((assetId) => registry.getAsset(assetId));
}
