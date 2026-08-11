import { createRouter } from "@tanstack/react-router";
import { action3dRoute } from "./routes/action3d-route";
import { gameRoute } from "./routes/game-route";
import { homeRoute } from "./routes/home-route";
import { loginRoute } from "./routes/login-route";
import { protectedRoute } from "./routes/protected-route";
import { rootRoute } from "./routes/root-route";
import { showcaseRoute } from "./routes/showcase-route";

const routeTree = rootRoute.addChildren([
	homeRoute,
	gameRoute,
	action3dRoute,
	showcaseRoute,
	loginRoute,
	protectedRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
