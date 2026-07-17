import {
	legacyPanelQueryRequestToV2,
	panelQueryRequestSchema,
	type PanelQueryRequest,
	type PanelQueryRequestV2,
} from "../../../../shared/schemas/dashboard.schema";

export function compatibilityPanelRequestV2ToV1(
	request: PanelQueryRequestV2,
): PanelQueryRequest {
	const parsed = panelQueryRequestSchema.parse({
		range: request.range,
		timezone: request.timezone,
		filters: request.filters,
		maxDataPoints: request.maxDataPoints,
	});
	return parsed;
}

export function compatibilityPanelRequestV1ToV2(
	request: PanelQueryRequest,
): PanelQueryRequestV2 {
	return legacyPanelQueryRequestToV2(request);
}

export function compatibilityFrameRefForLegacyPanel(refId = "A") {
	return { refId, outputFrameRefs: [refId], hidden: false } as const;
}
