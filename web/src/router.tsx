import { createRouter } from "@tanstack/react-router";
import { homeRoute } from "./routes/home-route";
import { loginRoute } from "./routes/login-route";
import { protectedRoute } from "./routes/protected-route";
import { rootRoute } from "./routes/root-route";
import { showcaseRoute } from "./routes/showcase-route";

const routeTree = rootRoute.addChildren([
	homeRoute,
	showcaseRoute,
	loginRoute,
	protectedRoute,
]);

type RouterOptions = Parameters<typeof createRouter>[0];

export function createAppRouter(history?: RouterOptions["history"]) {
	return createRouter({ routeTree, history });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
