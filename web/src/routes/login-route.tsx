import { createRoute } from "@tanstack/react-router";
import { LoginView } from "../views/login-view";
import { parseLoginSearch } from "./login-search";
import { rootRoute } from "./root-route";

export const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	validateSearch: parseLoginSearch,
	component: LoginView,
});
