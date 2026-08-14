import { createRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { parseShowcaseTableSearch } from "../showcase-table-search";
import { rootRoute } from "./root-route";

const LazyShowcaseView = lazy(async () => {
	const module = await import("../views/showcase-view");
	return { default: module.ShowcaseView };
});

function ShowcaseRouteView() {
	return (
		<Suspense
			fallback={
				<main className="page-shell" aria-busy="true">
					<p>Loading showcase…</p>
				</main>
			}
		>
			<LazyShowcaseView />
		</Suspense>
	);
}

export const showcaseRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/showcase",
	validateSearch: parseShowcaseTableSearch,
	component: ShowcaseRouteView,
});
