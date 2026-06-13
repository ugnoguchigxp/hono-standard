import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import { App, type AppViewId } from "./App";
import { ShowcaseSettingsProvider } from "./showcase-settings-context";
import { parseShowcaseTableSearch } from "./showcase-table-search";
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

const showcaseRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/showcase",
	validateSearch: parseShowcaseTableSearch,
	component: () => (
		<ShowcaseSettingsProvider>
			<ShowcaseView />
		</ShowcaseSettingsProvider>
	),
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
