import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { coreCandlestickVisualizationContract } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildOhlcModel } from "../financial/ohlc-model";
import {
	resolveSpecializedFieldConfig,
	validateOhlcUnits,
} from "../specialized/units";
export const coreCandlestickDefinition = defineFrontendVisualization({
	...coreCandlestickVisualizationContract,
	descriptor: {
		...coreCandlestickVisualizationContract.descriptor,
		capabilities: {
			...coreCandlestickVisualizationContract.descriptor.capabilities,
			annotations: true,
		},
	},
	validateFrames: (frames: DashboardDataFrameV2[], _config, preset) => {
		const frame = frames[0];
		if (!frame || frames.length !== 1)
			return "Candlestick requires one OHLC frame";
		if (
			preset === "volume" &&
			!frame.fields.some((field) => field.roles.includes("volume"))
		)
			return "Volume preset requires volume";
		return undefined;
	},
	validateResolvedFrames: (frames, config, preset, spec) => {
		const frame = frames[0];
		if (!frame) return "Candlestick requires one OHLC frame";
		const unitError = validateOhlcUnits(frame, spec);
		if (unitError) return unitError;
		const priceField = frame.fields.find((field) =>
			field.roles.includes("close"),
		);
		const resolved = priceField
			? resolveSpecializedFieldConfig(spec, frame, priceField)
			: undefined;
		if (
			config.yDomain === "config" &&
			(resolved?.min === undefined || resolved.max === undefined)
		)
			return "Configured OHLC domain requires field min and max";
		try {
			buildOhlcModel(
				frame,
				config,
				400,
				preset,
				resolved?.min !== undefined && resolved.max !== undefined
					? { min: resolved.min, max: resolved.max }
					: undefined,
			);
			return undefined;
		} catch (error) {
			return error instanceof Error ? error.message : "Invalid OHLC data";
		}
	},
	load: () => import("./renderer.lazy"),
	loadPolicy: "viewport" as const,
});
