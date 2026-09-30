import { createRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { PagesView } from "../views/pages-view";
import { rootRoute } from "./root-route";

function PagesLayout() {
	const pageId = useRouterState({
		select: (state) => {
			for (const match of state.matches) {
				if ("pageId" in match.params) return match.params.pageId;
			}
			return undefined;
		},
	});

	return (
		<>
			<PagesView pageId={pageId} />
			<Outlet />
		</>
	);
}

export const pagesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/pages",
	component: PagesLayout,
});
