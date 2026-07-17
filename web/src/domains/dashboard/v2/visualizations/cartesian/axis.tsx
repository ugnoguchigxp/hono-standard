import type { CartesianValueAxis } from "@shared/schemas/dashboard/cartesian-visualizations.schema";

export function resolveCartesianDomain(
	axis: CartesianValueAxis,
	percent = false,
): ["auto" | number, "auto" | number] {
	return percent ? [0, 100] : [axis.min, axis.max];
}
export function shouldShowCartesianAxis(
	axis: CartesianValueAxis,
	compact = false,
) {
	return axis.show && !compact;
}
