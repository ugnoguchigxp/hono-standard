import { createRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { rootRoute } from "./root-route";

const GameView = lazy(() => import("../views/game-view"));

function GameRouteComponent() {
	return (
		<Suspense
			fallback={
				<main className="center-shell">
					<div className="muted" role="status">
						Loading 2D game module...
					</div>
				</main>
			}
		>
			<GameView />
		</Suspense>
	);
}

export const gameRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/game",
	component: GameRouteComponent,
});
