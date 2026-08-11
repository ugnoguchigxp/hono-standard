import { lazy, Suspense } from "react";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./root-route";

const Action3dView = lazy(() => import("../action3d/Action3dView"));

function Action3dRouteComponent() {
	return (
		<Suspense
			fallback={
				<main className="center-shell">
					<div className="muted" role="status">
						Loading Action3D module...
					</div>
				</main>
			}
		>
			<Action3dView />
		</Suspense>
	);
}

export const action3dRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/games/action-3d",
	component: Action3dRouteComponent,
});
