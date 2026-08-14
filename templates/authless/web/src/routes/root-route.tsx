import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

function AppLayout() {
	return (
		<div className="app-root">
			<header className="topbar">
				<Link to="/" className="brand">
					hono-standard
				</Link>
				<nav aria-label="Primary">
					<Link
						to="/"
						className="menu-link"
						activeProps={{ className: "menu-link active" }}
					>
						Home
					</Link>
				</nav>
			</header>
			<Outlet />
		</div>
	);
}

export const rootRoute = createRootRoute({ component: AppLayout });
