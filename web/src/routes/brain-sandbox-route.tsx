import { createRoute } from "@tanstack/react-router";
import { BrainSandboxView } from "../views/brain-sandbox-view";
import { rootRoute } from "./root-route";
export const brainSandboxRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/brain-sandbox",
	component: BrainSandboxView,
});
