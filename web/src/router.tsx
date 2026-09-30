import { createRouter } from "@tanstack/react-router";
import { homeRoute } from "./routes/home-route";
import { loginRoute } from "./routes/login-route";
import { pageDetailRoute } from "./routes/page-detail-route";
import { pagesRoute } from "./routes/pages-route";
import { protectedRoute } from "./routes/protected-route";
import { rootRoute } from "./routes/root-route";
import { showcaseRoute } from "./routes/showcase-route";

const routeTree = rootRoute.addChildren([
	homeRoute,
	showcaseRoute,
	loginRoute,
	protectedRoute,
	pagesRoute.addChildren([pageDetailRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
