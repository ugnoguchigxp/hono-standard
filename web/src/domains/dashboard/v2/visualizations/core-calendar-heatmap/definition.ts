import {
	type CalendarHeatmapConfigV1,
	calendarHeatmapConfigV1Schema,
	coreCalendarHeatmapVisualizationContract,
} from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { defineFrontendVisualization } from "../../runtime/visualization-types";
import { buildCalendarModel } from "../distribution/calendar";
export const calendarHeatmapConfigSchema = calendarHeatmapConfigV1Schema;
export const coreCalendarHeatmapDefinition =
	defineFrontendVisualization<CalendarHeatmapConfigV1>({
		...coreCalendarHeatmapVisualizationContract,
		validateFrames: (frames, config) => {
			const frame = frames[0];
			if (!frame) return "Calendar data frame is missing";
			try {
				if (buildCalendarModel(frame, config, "UTC").length > 728)
					return "Calendar cell limit exceeded";
			} catch (error) {
				return error instanceof Error ? error.message : "Invalid calendar data";
			}
			return undefined;
		},
		load: () => import("./renderer.lazy"),
		loadPolicy: "viewport",
	});
