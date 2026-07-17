import { createRoute } from "@tanstack/react-router";
import { parseDashboardRouteSearch } from "./dashboard-route-search";
import { rootRoute } from "./root-route";

export const dashboardGalleryRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/dashboard/gallery",
	validateSearch: parseDashboardRouteSearch,
}).lazy(() =>
	import("./dashboard-gallery-route.lazy").then(
		(module) => module.dashboardGalleryLazyRoute,
	),
);
