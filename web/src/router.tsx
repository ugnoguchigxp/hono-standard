import {
	createRootRoute,
	createRoute,
	createRouter,
	Link,
	Outlet,
} from "@tanstack/react-router";
import {
	BookOpen,
	Bot,
	Database,
	Grid2X2,
	Search,
	Settings,
} from "lucide-react";
import { App, type AppViewId } from "./App";
import { ShowcaseSettingsProvider } from "./showcase-settings-context";
import {
	defaultShowcaseTableSearch,
	parseShowcaseTableSearch,
} from "./showcase-table-search";
import { ShowcaseView } from "./views/showcase-view";

const rootRoute = createRootRoute({
	component: () => <Outlet />,
});

const renderAppView = (view: AppViewId) => () => <App view={view} />;

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: renderAppView("chat"),
});

const chatRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/chat",
	component: renderAppView("chat"),
});

const knowledgeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/knowledge",
	component: renderAppView("knowledge"),
});

const searchRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/search",
	component: renderAppView("search"),
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: renderAppView("settings"),
});

const adminRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/admin",
	component: renderAppView("admin"),
});

function ShowcasePage() {
	return (
		<div className="app-root">
			<header className="topbar">
				<Link className="brand" to="/chat">
					<Database className="icon" />
					<span>hono-standard rag</span>
				</Link>
				<nav className="tab-nav" aria-label="Primary">
					<Link className="tab" to="/knowledge">
						<BookOpen className="icon" />
						<span>Knowledge</span>
					</Link>
					<Link className="tab" to="/chat">
						<Bot className="icon" />
						<span>Chat</span>
					</Link>
					<Link className="tab" to="/search">
						<Search className="icon" />
						<span>Search</span>
					</Link>
					<Link className="tab" to="/settings">
						<Settings className="icon" />
						<span>Settings</span>
					</Link>
					<Link
						className="tab active"
						to="/showcase"
						search={defaultShowcaseTableSearch}
					>
						<Grid2X2 className="icon" />
						<span>Showcase</span>
					</Link>
				</nav>
			</header>
			<ShowcaseSettingsProvider>
				<ShowcaseView />
			</ShowcaseSettingsProvider>
		</div>
	);
}

const showcaseRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/showcase",
	validateSearch: parseShowcaseTableSearch,
	component: ShowcasePage,
});

const routeTree = rootRoute.addChildren([
	homeRoute,
	chatRoute,
	knowledgeRoute,
	searchRoute,
	settingsRoute,
	adminRoute,
	showcaseRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
