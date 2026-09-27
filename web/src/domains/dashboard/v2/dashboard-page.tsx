import {
	createLazyRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useAuth } from "../../../auth-context";

const GridSurface = lazy(() =>
	import("./grid-surface").then((module) => ({ default: module.GridSurface })),
);
const SpatialSurface = lazy(() =>
	import("./spatial/spatial-surface").then((module) => ({
		default: module.SpatialSurface,
	})),
);

function AuthenticatedDashboardPage() {
	const search = useSearch({ from: "/dashboard" });
	const navigate = useNavigate({ from: "/dashboard" });
	const surface = search.surface === "spatial" ? "spatial" : "grid";
	const [gridEditing, setGridEditing] = useState(false);
	const changeSurface = (next: "grid" | "spatial") => {
		if (gridEditing && next === "spatial") return;
		void navigate({
			search: (previous) => ({
				...previous,
				surface: next === "grid" ? undefined : next,
			}),
			resetScroll: false,
		});
	};
	return (
		<>
			<nav className="dashboard-surface-nav" aria-label="Dashboard surface">
				<button
					type="button"
					aria-current={surface === "grid" ? "page" : undefined}
					onClick={() => changeSurface("grid")}
				>
					Grid
				</button>
				<button
					type="button"
					aria-current={surface === "spatial" ? "page" : undefined}
					disabled={gridEditing}
					title={
						gridEditing ? "Save or cancel layout changes first" : undefined
					}
					onClick={() => changeSurface("spatial")}
				>
					Spatial
				</button>
				<span className="dashboard-surface-context">Operations dashboard</span>
			</nav>
			<Suspense
				fallback={
					<main className="dashboard-page">
						<div className="dashboard-loading">Loading dashboard…</div>
					</main>
				}
			>
				{surface === "grid" ? (
					<GridSurface onEditingChange={setGridEditing} />
				) : (
					<SpatialSurface />
				)}
			</Suspense>
		</>
	);
}

export function DashboardPageV2() {
	const { authUser, authLoading } = useAuth();
	if (authLoading)
		return (
			<main className="center-shell">
				<div className="muted">Checking session...</div>
			</main>
		);
	if (!authUser)
		return (
			<main className="center-shell">
				<section className="signed-in-panel">
					<h1>Login required</h1>
					<p>This dashboard is available after sign-in.</p>
					<Link
						to="/login"
						search={{ redirect: "/dashboard" }}
						className="auth-open-button"
					>
						Login
					</Link>
				</section>
			</main>
		);
	return <AuthenticatedDashboardPage />;
}

export const dashboardV2LazyRoute = createLazyRoute("/dashboard")({
	component: DashboardPageV2,
});
