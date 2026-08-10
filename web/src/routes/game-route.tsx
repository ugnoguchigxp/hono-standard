import { createRoute } from "@tanstack/react-router";
import { GameView } from "../views/game-view";
import { rootRoute } from "./root-route";

export const gameRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/game",
	component: GameView,
});
