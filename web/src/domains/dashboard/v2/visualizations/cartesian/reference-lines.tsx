import type { CartesianReferenceLine } from "@shared/schemas/dashboard/cartesian-visualizations.schema";

export function referenceLineStrokeDash(line: CartesianReferenceLine) {
	return line.lineStyle === "dashed"
		? "4 4"
		: line.lineStyle === "dotted"
			? "1 3"
			: undefined;
}
