import { createRoute } from "@tanstack/react-router";
import { parseDashboardRouteSearch } from "./dashboard-route-search";
import { rootRoute } from "./root-route";

export const dashboardRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/dashboard",
	validateSearch: parseDashboardRouteSearch,
}).lazy(() =>
	import("./dashboard-route.lazy").then((module) => module.dashboardLazyRoute),
);
