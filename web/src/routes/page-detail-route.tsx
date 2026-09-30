import { createRoute } from "@tanstack/react-router";
import { pagesRoute } from "./pages-route";

function PageDetailRoute() {
	return null;
}

export const pageDetailRoute = createRoute({
	getParentRoute: () => pagesRoute,
	path: "$pageId",
	component: PageDetailRoute,
});
