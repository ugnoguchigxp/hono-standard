import { createRouter } from "@tanstack/react-router";
import { homeRoute } from "./routes/home-route";
import { rootRoute } from "./routes/root-route";

const routeTree = rootRoute.addChildren([homeRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
