import { Link, Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter, useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import ReactDOMServer from "react-dom/server";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, jsxDEV } from "react/jsx-dev-runtime";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, AtSign, Bell, Calendar, Check, ChevronDown, Clipboard, Copy, CreditCard, Database, FileStack, FileText, Folder, Grid2X2, Home, Info, KeyRound, LayoutGrid, List, LoaderCircle, LockKeyhole, LogOut, Mail, MoreHorizontal, PanelRight, RefreshCcw, Search, Settings, Shield, ShieldCheck, SlidersHorizontal, Star, X } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { hc } from "hono/client";
import { useForm } from "react-hook-form";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
//#region web/src/views/home-view.tsx
var _jsxFileName$10 = "/Users/y.noguchi/Code/hono-standard/web/src/views/home-view.tsx";
function HomeView() {
	return /* @__PURE__ */ jsxDEV("main", {
		className: "home-shell",
		children: /* @__PURE__ */ jsxDEV("section", {
			className: "home-panel",
			children: [
				/* @__PURE__ */ jsxDEV("h1", { children: "Welcome to Hono Standard" }, void 0, false, {
					fileName: _jsxFileName$10,
					lineNumber: 5,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("p", { children: "Hono Standard is a compact full-stack starter that pairs a Hono API with a React and Vite frontend on a single origin." }, void 0, false, {
					fileName: _jsxFileName$10,
					lineNumber: 6,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("p", { children: "It includes SQLite-backed authentication, httpOnly cookie sessions, typed routing, and a reusable component showcase without forcing login on public screens." }, void 0, false, {
					fileName: _jsxFileName$10,
					lineNumber: 10,
					columnNumber: 5
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName$10,
			lineNumber: 4,
			columnNumber: 4
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$10,
		lineNumber: 3,
		columnNumber: 3
	}, this);
}
//#endregion
//#region web/src/api.ts
var UNAUTHORIZED_EVENT_NAME = "hono-standard:unauthorized";
var authMeQueryKey = ["auth", "me"];
var protectedProfileQueryKey = ["protected", "profile"];
var lastUnauthorizedEventAt = 0;
var notifyUnauthorized = () => {
	if (typeof window === "undefined") return;
	const now = Date.now();
	if (now - lastUnauthorizedEventAt < 500) return;
	lastUnauthorizedEventAt = now;
	window.dispatchEvent(new Event(UNAUTHORIZED_EVENT_NAME));
};
var getRequestPath = (input) => {
	const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input.toString();
	const base = typeof window === "undefined" ? "http://localhost" : window.location.origin;
	return new URL(url, base).pathname;
};
var isAuthPath = (path) => path.startsWith("/api/auth/");
var canRetryWithRefresh = (path) => !isAuthPath(path);
var shouldNotifyUnauthorized = (path) => !isAuthPath(path);
var parseErrorMessage = async (response) => {
	let message = `Request failed: ${response.status}`;
	try {
		const data = await response.json();
		if (data.message) message = data.message;
	} catch {}
	return message;
};
var customFetch = async (input, init) => {
	const headers = new Headers(init?.headers);
	const requestPath = getRequestPath(input);
	const execute = () => fetch(input, {
		...init,
		headers,
		credentials: "include"
	});
	let response = await execute();
	if (response.status === 401 && canRetryWithRefresh(requestPath)) {
		if ((await fetch("/api/auth/refresh", {
			method: "POST",
			credentials: "include"
		})).ok) response = await execute();
	}
	if (response.status === 401 && shouldNotifyUnauthorized(requestPath)) notifyUnauthorized();
	return response;
};
var client = hc("/api", { fetch: customFetch });
async function parseJsonResponse(response) {
	if (!response.ok) throw new Error(await parseErrorMessage(response));
	return await response.json();
}
async function login(params) {
	return parseJsonResponse(await client.auth.login.$post({ json: {
		email: params.email,
		password: params.password
	} }));
}
async function logout() {
	await parseJsonResponse(await client.auth.logout.$post());
}
async function fetchMe() {
	const rawResponse = await client.auth.me.$get();
	if (rawResponse.status === 401) return null;
	return (await parseJsonResponse(rawResponse)).user;
}
async function fetchProtectedProfile() {
	return (await parseJsonResponse(await client.protected.profile.$get())).profile;
}
function useCurrentUserQuery(enabled = true) {
	return useQuery({
		queryKey: authMeQueryKey,
		queryFn: fetchMe,
		enabled
	});
}
function useProtectedProfileQuery(enabled = true) {
	return useQuery({
		queryKey: protectedProfileQueryKey,
		queryFn: fetchProtectedProfile,
		enabled
	});
}
function useLoginMutation(options) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: login,
		...options,
		onSuccess: async (response, variables, onMutateResult, context) => {
			queryClient.setQueryData(authMeQueryKey, response.user);
			await options?.onSuccess?.(response, variables, onMutateResult, context);
		}
	});
}
function useLogoutMutation(options) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: logout,
		...options,
		onSettled: async (data, error, variables, onMutateResult, context) => {
			queryClient.setQueryData(authMeQueryKey, null);
			await options?.onSettled?.(data, error, variables, onMutateResult, context);
		}
	});
}
//#endregion
//#region web/src/auth-context.tsx
var _jsxFileName$9 = "/Users/y.noguchi/Code/hono-standard/web/src/auth-context.tsx";
var AuthContext = createContext(null);
var isUnauthorizedError = (error) => error instanceof Error && (error.message === "Unauthorized" || error.message.includes("401"));
function useAuth() {
	const value = useContext(AuthContext);
	if (!value) throw new Error("AuthContext is missing.");
	return value;
}
function AuthProvider({ children, sessionCheckEnabled = true }) {
	const navigate = useNavigate();
	const client = useQueryClient();
	const [errorText, setErrorText] = useState(null);
	const meQuery = useCurrentUserQuery(sessionCheckEnabled);
	useEffect(() => {
		if (meQuery.error && !isUnauthorizedError(meQuery.error)) setErrorText(meQuery.error instanceof Error ? meQuery.error.message : "Failed to load app.");
	}, [meQuery.error]);
	useEffect(() => {
		const onUnauthorized = () => {
			client.setQueryData(authMeQueryKey, null);
			setErrorText("Session expired.");
		};
		window.addEventListener(UNAUTHORIZED_EVENT_NAME, onUnauthorized);
		return () => window.removeEventListener(UNAUTHORIZED_EVENT_NAME, onUnauthorized);
	}, [client]);
	const loginMutation = useLoginMutation({
		onSuccess: async (_response, variables) => {
			setErrorText(null);
			await navigate({ to: variables.redirectTo ?? "/" });
		},
		onError: (error) => {
			setErrorText(error instanceof Error ? error.message : "Login failed.");
		}
	});
	const logoutMutation = useLogoutMutation({ onSettled: async () => {
		setErrorText(null);
	} });
	const value = useMemo(() => ({
		authUser: meQuery.data ?? null,
		authLoading: sessionCheckEnabled && meQuery.isPending,
		busy: loginMutation.isPending || logoutMutation.isPending,
		errorText,
		loginWithPassword: async (params) => {
			if (!params.email || !params.password) return false;
			try {
				await loginMutation.mutateAsync({
					email: params.email,
					password: params.password,
					redirectTo: params.redirectTo
				});
				return true;
			} catch {
				return false;
			}
		},
		logoutCurrentUser: async () => {
			await logoutMutation.mutateAsync();
		}
	}), [
		errorText,
		loginMutation.isPending,
		loginMutation.mutateAsync,
		logoutMutation.isPending,
		logoutMutation.mutateAsync,
		meQuery.data,
		meQuery.isPending,
		sessionCheckEnabled
	]);
	return /* @__PURE__ */ jsxDEV(AuthContext.Provider, {
		value,
		children
	}, void 0, false, {
		fileName: _jsxFileName$9,
		lineNumber: 131,
		columnNumber: 9
	}, this);
}
//#endregion
//#region web/src/components/dev-error-panel.tsx
var _jsxFileName$8 = "/Users/y.noguchi/Code/hono-standard/web/src/components/dev-error-panel.tsx";
function getErrorDetails(error, componentStack) {
	const location = typeof window === "undefined" ? "unknown" : window.location.href;
	const pathname = typeof window === "undefined" ? "unknown" : window.location.pathname;
	const timestamp = (/* @__PURE__ */ new Date()).toISOString();
	if (error instanceof Error) return {
		name: error.name || "Error",
		message: error.message || "Unknown error",
		stack: error.stack || `${error.name}: ${error.message}`,
		componentStack: componentStack?.trim() ?? "",
		location,
		pathname,
		timestamp
	};
	return {
		name: "Thrown value",
		message: typeof error === "string" ? error : "A non-Error value was thrown.",
		stack: typeof error === "string" ? error : JSON.stringify(error, null, 2) || String(error),
		componentStack: componentStack?.trim() ?? "",
		location,
		pathname,
		timestamp
	};
}
function normalizeFrame(frame) {
	const origin = typeof window === "undefined" ? "" : window.location.origin;
	return frame.trim().replace(origin, "").replace(/^at\s+/, "").replace(/\?.*?:/, ":");
}
function extractAppFrames(stack) {
	const appFrameMarkers = [
		"/web/src/",
		"/api/",
		"/shared/"
	];
	return stack.split("\n").map(normalizeFrame).filter((line) => appFrameMarkers.some((marker) => line.includes(marker))).filter((line, index, lines) => lines.indexOf(line) === index).slice(0, 5);
}
function extractTopFrames(stack, appFrames) {
	if (appFrames.length > 0) return appFrames.slice(0, 3);
	return stack.split("\n").slice(1).map(normalizeFrame).filter(Boolean).filter((line, index, lines) => lines.indexOf(line) === index).slice(0, 3);
}
function extractComponentFrames(componentStack) {
	return componentStack.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6);
}
function inferRouteHints(pathname) {
	if (pathname === "/") return [
		"web/src/routes/root-route.tsx",
		"web/src/routes/home-route.tsx",
		"web/src/views/home-view.tsx"
	];
	if (pathname.startsWith("/showcase")) return [
		"web/src/routes/root-route.tsx",
		"web/src/routes/showcase-route.tsx",
		"web/src/views/showcase-view.tsx"
	];
	if (pathname.startsWith("/login")) return [
		"web/src/routes/root-route.tsx",
		"web/src/routes/login-route.tsx",
		"web/src/views/login-view.tsx"
	];
	return ["web/src/routes/root-route.tsx"];
}
function formatFullDetails(details) {
	return [
		`${details.name}: ${details.message}`,
		`URL: ${details.location}`,
		`Time: ${details.timestamp}`,
		"",
		"Stack trace:",
		details.stack,
		details.componentStack ? "\nReact component stack:" : "",
		details.componentStack
	].filter(Boolean).join("\n");
}
function formatAiContext(details, appFrames, topFrames, componentFrames, routeHints) {
	return [
		"## Error",
		`${details.name}: ${details.message}`,
		"",
		"## Runtime",
		`Route: ${details.pathname}`,
		`URL: ${details.location}`,
		`Mode: production`,
		"",
		"## Suspect app frames",
		...appFrames.length ? appFrames.map((frame) => `- ${frame}`) : ["- none"],
		"",
		"## Top stack frames",
		...topFrames.length ? topFrames.map((frame) => `- ${frame}`) : ["- none"],
		"",
		"## Route file hints",
		...routeHints.map((hint) => `- ${hint}`),
		"",
		"## React component stack",
		...componentFrames.length ? componentFrames.map((frame) => `- ${frame}`) : ["- none"],
		"",
		"## Request",
		"Find the likely cause and propose the smallest fix. Full stack trace is omitted to save context unless needed."
	].join("\n");
}
function buildDiagnosticContext(details) {
	const appFrames = extractAppFrames(details.stack);
	const topFrames = extractTopFrames(details.stack, appFrames);
	const componentFrames = extractComponentFrames(details.componentStack);
	const routeHints = inferRouteHints(details.pathname);
	return {
		appFrames,
		topFrames,
		componentFrames,
		routeHints,
		aiContext: formatAiContext(details, appFrames, topFrames, componentFrames, routeHints),
		fullDetails: formatFullDetails(details)
	};
}
async function copyText(text) {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.left = "-9999px";
	document.body.appendChild(textarea);
	textarea.select();
	document.execCommand("copy");
	document.body.removeChild(textarea);
}
function DevErrorPanel({ error, info, reset }) {
	const [copyStatus, setCopyStatus] = useState("idle");
	const details = useMemo(() => getErrorDetails(error, info?.componentStack), [error, info?.componentStack]);
	const diagnosticContext = useMemo(() => buildDiagnosticContext(details), [details]);
	async function handleCopy(text, status) {
		try {
			await copyText(text);
			setCopyStatus(status);
			window.setTimeout(() => setCopyStatus("idle"), 1600);
		} catch {
			setCopyStatus("failed");
		}
	}
	return /* @__PURE__ */ jsxDEV("main", {
		className: "dev-error-shell",
		children: /* @__PURE__ */ jsxDEV("section", {
			className: "dev-error-panel",
			"aria-labelledby": "dev-error-title",
			children: [
				/* @__PURE__ */ jsxDEV("div", {
					className: "dev-error-header",
					children: [/* @__PURE__ */ jsxDEV("div", {
						className: "dev-error-title-row",
						children: [/* @__PURE__ */ jsxDEV("span", {
							className: "dev-error-icon",
							children: /* @__PURE__ */ jsxDEV(AlertTriangle, { className: "icon" }, void 0, false, {
								fileName: _jsxFileName$8,
								lineNumber: 242,
								columnNumber: 8
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 241,
							columnNumber: 7
						}, this), /* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("p", {
							className: "dev-error-kicker",
							children: "Application error"
						}, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 245,
							columnNumber: 8
						}, this), /* @__PURE__ */ jsxDEV("h1", {
							id: "dev-error-title",
							children: details.message
						}, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 246,
							columnNumber: 8
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$8,
							lineNumber: 244,
							columnNumber: 7
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$8,
						lineNumber: 240,
						columnNumber: 6
					}, this), /* @__PURE__ */ jsxDEV("div", {
						className: "dev-error-actions",
						children: [
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "dev-error-action",
								"aria-label": "Copy AI context",
								title: "Copy AI context",
								onClick: () => void handleCopy(diagnosticContext.aiContext, "ai-copied"),
								children: [/* @__PURE__ */ jsxDEV(Clipboard, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$8,
									lineNumber: 259,
									columnNumber: 8
								}, this), copyStatus === "ai-copied" ? "AI context copied" : copyStatus === "failed" ? "Copy failed" : "Copy AI context"]
							}, void 0, true, {
								fileName: _jsxFileName$8,
								lineNumber: 250,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "dev-error-action",
								"aria-label": "Copy full error details",
								title: "Copy full error details",
								onClick: () => void handleCopy(diagnosticContext.fullDetails, "full-copied"),
								children: [/* @__PURE__ */ jsxDEV(FileStack, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$8,
									lineNumber: 275,
									columnNumber: 8
								}, this), copyStatus === "full-copied" ? "Full stack copied" : "Copy full"]
							}, void 0, true, {
								fileName: _jsxFileName$8,
								lineNumber: 266,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "dev-error-action",
								"aria-label": "Retry render",
								title: "Retry render",
								onClick: reset,
								children: [/* @__PURE__ */ jsxDEV(RefreshCcw, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$8,
									lineNumber: 285,
									columnNumber: 8
								}, this), "Retry"]
							}, void 0, true, {
								fileName: _jsxFileName$8,
								lineNumber: 278,
								columnNumber: 7
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$8,
						lineNumber: 249,
						columnNumber: 6
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$8,
					lineNumber: 239,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("div", {
					className: "dev-error-meta",
					children: [
						/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "Name" }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 293,
							columnNumber: 7
						}, this), /* @__PURE__ */ jsxDEV("strong", { children: details.name }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 294,
							columnNumber: 7
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$8,
							lineNumber: 292,
							columnNumber: 6
						}, this),
						/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "URL" }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 297,
							columnNumber: 7
						}, this), /* @__PURE__ */ jsxDEV("strong", { children: details.location }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 298,
							columnNumber: 7
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$8,
							lineNumber: 296,
							columnNumber: 6
						}, this),
						/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "Time" }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 301,
							columnNumber: 7
						}, this), /* @__PURE__ */ jsxDEV("strong", { children: details.timestamp }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 302,
							columnNumber: 7
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$8,
							lineNumber: 300,
							columnNumber: 6
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName$8,
					lineNumber: 291,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("div", {
					className: "dev-error-section",
					children: [/* @__PURE__ */ jsxDEV("div", {
						className: "dev-error-section-header",
						children: /* @__PURE__ */ jsxDEV("h2", { children: "AI context preview" }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 308,
							columnNumber: 7
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 307,
						columnNumber: 6
					}, this), /* @__PURE__ */ jsxDEV("pre", { children: diagnosticContext.aiContext }, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 310,
						columnNumber: 6
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$8,
					lineNumber: 306,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("div", {
					className: "dev-error-section",
					children: [/* @__PURE__ */ jsxDEV("div", {
						className: "dev-error-section-header",
						children: /* @__PURE__ */ jsxDEV("h2", { children: diagnosticContext.appFrames.length ? "Suspect app frames" : "Top stack frames" }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 315,
							columnNumber: 7
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 314,
						columnNumber: 6
					}, this), /* @__PURE__ */ jsxDEV("ul", {
						className: "dev-error-list",
						children: (diagnosticContext.appFrames.length ? diagnosticContext.appFrames : diagnosticContext.topFrames).map((frame) => /* @__PURE__ */ jsxDEV("li", { children: frame }, frame, false, {
							fileName: _jsxFileName$8,
							lineNumber: 326,
							columnNumber: 8
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 321,
						columnNumber: 6
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$8,
					lineNumber: 313,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("div", {
					className: "dev-error-section",
					children: [/* @__PURE__ */ jsxDEV("div", {
						className: "dev-error-section-header",
						children: /* @__PURE__ */ jsxDEV("h2", { children: "Route file hints" }, void 0, false, {
							fileName: _jsxFileName$8,
							lineNumber: 333,
							columnNumber: 7
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 332,
						columnNumber: 6
					}, this), /* @__PURE__ */ jsxDEV("ul", {
						className: "dev-error-list",
						children: diagnosticContext.routeHints.map((frame) => /* @__PURE__ */ jsxDEV("li", { children: frame }, frame, false, {
							fileName: _jsxFileName$8,
							lineNumber: 337,
							columnNumber: 8
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 335,
						columnNumber: 6
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$8,
					lineNumber: 331,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("div", {
					className: "dev-error-section",
					children: /* @__PURE__ */ jsxDEV("details", { children: [/* @__PURE__ */ jsxDEV("summary", { children: "Full stack trace" }, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 344,
						columnNumber: 7
					}, this), /* @__PURE__ */ jsxDEV("pre", { children: details.stack }, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 345,
						columnNumber: 7
					}, this)] }, void 0, true, {
						fileName: _jsxFileName$8,
						lineNumber: 343,
						columnNumber: 6
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName$8,
					lineNumber: 342,
					columnNumber: 5
				}, this),
				details.componentStack ? /* @__PURE__ */ jsxDEV("div", {
					className: "dev-error-section",
					children: /* @__PURE__ */ jsxDEV("details", { children: [/* @__PURE__ */ jsxDEV("summary", { children: "Full React component stack" }, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 352,
						columnNumber: 8
					}, this), /* @__PURE__ */ jsxDEV("pre", { children: details.componentStack }, void 0, false, {
						fileName: _jsxFileName$8,
						lineNumber: 353,
						columnNumber: 8
					}, this)] }, void 0, true, {
						fileName: _jsxFileName$8,
						lineNumber: 351,
						columnNumber: 7
					}, this)
				}, void 0, false, {
					fileName: _jsxFileName$8,
					lineNumber: 350,
					columnNumber: 6
				}, this) : null
			]
		}, void 0, true, {
			fileName: _jsxFileName$8,
			lineNumber: 238,
			columnNumber: 4
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$8,
		lineNumber: 237,
		columnNumber: 3
	}, this);
}
//#endregion
//#region web/src/showcase-table-search.ts
var showcaseTableSortFields = [
	"component",
	"category",
	"status"
];
var showcaseTablePageSizes = [
	5,
	10,
	20,
	50
];
var defaultShowcaseTableSearch = {
	page: 1,
	pageSize: 10
};
function parseShowcaseTableSearch(search) {
	const page = parsePositiveInteger(search.page, defaultShowcaseTableSearch.page);
	const pageSize = isShowcasePageSize(search.pageSize) ? Number(search.pageSize) : defaultShowcaseTableSearch.pageSize;
	const sortBy = isShowcaseSortField(search.sortBy) ? search.sortBy : void 0;
	const sortDir = isShowcaseSortDirection(search.sortDir) ? search.sortDir : void 0;
	return {
		page,
		pageSize,
		sortBy,
		sortDir: sortBy ? sortDir ?? "asc" : void 0
	};
}
function isShowcaseSortField(value) {
	return showcaseTableSortFields.some((field) => field === value);
}
function isShowcasePageSize(value) {
	const parsed = Number(value);
	return showcaseTablePageSizes.some((pageSize) => pageSize === parsed);
}
function isShowcaseSortDirection(value) {
	return value === "asc" || value === "desc";
}
function parsePositiveInteger(value, fallback) {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) return fallback;
	return parsed;
}
//#endregion
//#region web/src/routes/route-access.ts
var sessionCheckedPathPrefixes = ["/protected"];
function requiresSessionCheck(pathname) {
	return pathname === "/login" || sessionCheckedPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
//#endregion
//#region web/src/routes/root-route.tsx
var _jsxFileName$7 = "/Users/y.noguchi/Code/hono-standard/web/src/routes/root-route.tsx";
function AppLayout() {
	const { authUser, busy, errorText, logoutCurrentUser } = useAuth();
	return /* @__PURE__ */ jsxDEV("div", {
		className: "app-root min-h-screen",
		children: [
			/* @__PURE__ */ jsxDEV("header", {
				className: "topbar",
				children: [/* @__PURE__ */ jsxDEV(Link, {
					to: "/",
					className: "brand",
					children: [/* @__PURE__ */ jsxDEV(Database, { className: "icon" }, void 0, false, {
						fileName: _jsxFileName$7,
						lineNumber: 20,
						columnNumber: 6
					}, this), /* @__PURE__ */ jsxDEV("span", { children: "hono-standard" }, void 0, false, {
						fileName: _jsxFileName$7,
						lineNumber: 21,
						columnNumber: 6
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$7,
					lineNumber: 19,
					columnNumber: 5
				}, this), /* @__PURE__ */ jsxDEV("div", {
					className: "topbar-actions",
					children: [/* @__PURE__ */ jsxDEV("nav", {
						className: "menu-nav",
						"aria-label": "Primary",
						children: [
							/* @__PURE__ */ jsxDEV(Link, {
								to: "/",
								className: "menu-link",
								activeProps: { className: "menu-link active" },
								children: [/* @__PURE__ */ jsxDEV(Home, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$7,
									lineNumber: 30,
									columnNumber: 8
								}, this), "Home"]
							}, void 0, true, {
								fileName: _jsxFileName$7,
								lineNumber: 25,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV(Link, {
								to: "/showcase",
								search: defaultShowcaseTableSearch,
								className: "menu-link",
								activeProps: { className: "menu-link active" },
								children: [/* @__PURE__ */ jsxDEV(LayoutGrid, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$7,
									lineNumber: 39,
									columnNumber: 8
								}, this), "Showcase"]
							}, void 0, true, {
								fileName: _jsxFileName$7,
								lineNumber: 33,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV(Link, {
								to: "/login",
								className: "menu-link",
								activeProps: { className: "menu-link active" },
								children: "Login"
							}, void 0, false, {
								fileName: _jsxFileName$7,
								lineNumber: 42,
								columnNumber: 7
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$7,
						lineNumber: 24,
						columnNumber: 6
					}, this), authUser ? /* @__PURE__ */ jsxDEV(Fragment, { children: [/* @__PURE__ */ jsxDEV("div", {
						className: "auth-chip",
						children: [/* @__PURE__ */ jsxDEV(Shield, { className: "icon" }, void 0, false, {
							fileName: _jsxFileName$7,
							lineNumber: 53,
							columnNumber: 9
						}, this), /* @__PURE__ */ jsxDEV("span", { children: [
							authUser.displayName,
							" (",
							authUser.role,
							")"
						] }, void 0, true, {
							fileName: _jsxFileName$7,
							lineNumber: 54,
							columnNumber: 9
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$7,
						lineNumber: 52,
						columnNumber: 8
					}, this), /* @__PURE__ */ jsxDEV("button", {
						type: "button",
						className: "icon-button",
						onClick: () => void logoutCurrentUser(),
						disabled: busy,
						"aria-label": "Logout",
						title: "Logout",
						children: /* @__PURE__ */ jsxDEV(LogOut, { className: "icon" }, void 0, false, {
							fileName: _jsxFileName$7,
							lineNumber: 66,
							columnNumber: 9
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName$7,
						lineNumber: 58,
						columnNumber: 8
					}, this)] }, void 0, true, {
						fileName: _jsxFileName$7,
						lineNumber: 51,
						columnNumber: 7
					}, this) : null]
				}, void 0, true, {
					fileName: _jsxFileName$7,
					lineNumber: 23,
					columnNumber: 5
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$7,
				lineNumber: 18,
				columnNumber: 4
			}, this),
			errorText ? /* @__PURE__ */ jsxDEV("div", {
				className: "status error",
				children: errorText
			}, void 0, false, {
				fileName: _jsxFileName$7,
				lineNumber: 73,
				columnNumber: 17
			}, this) : null,
			/* @__PURE__ */ jsxDEV(Outlet, {}, void 0, false, {
				fileName: _jsxFileName$7,
				lineNumber: 75,
				columnNumber: 4
			}, this)
		]
	}, void 0, true, {
		fileName: _jsxFileName$7,
		lineNumber: 17,
		columnNumber: 3
	}, this);
}
function AppShell() {
	return /* @__PURE__ */ jsxDEV(AuthProvider, {
		sessionCheckEnabled: requiresSessionCheck(useRouterState({ select: (state) => state.location.pathname })),
		children: /* @__PURE__ */ jsxDEV(AppLayout, {}, void 0, false, {
			fileName: _jsxFileName$7,
			lineNumber: 87,
			columnNumber: 4
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$7,
		lineNumber: 86,
		columnNumber: 3
	}, this);
}
var rootRoute = createRootRoute({
	component: AppShell,
	errorComponent: DevErrorPanel
});
//#endregion
//#region web/src/routes/home-route.tsx
var homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomeView
});
//#endregion
//#region web/src/routes/login-search.ts
var isSafeRedirect = (value) => typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
function parseLoginSearch(search) {
	return { redirect: isSafeRedirect(search.redirect) ? search.redirect : void 0 };
}
//#endregion
//#region web/src/domains/auth/login-domain.tsx
var _jsxFileName$6 = "/Users/y.noguchi/Code/hono-standard/web/src/domains/auth/login-domain.tsx";
var LoginDomainSection = ({ active, busy, redirectTo, onLogin }) => {
	const { register, handleSubmit, resetField, formState: { isSubmitting } } = useForm({ defaultValues: {
		email: "",
		password: ""
	} });
	const submitLogin = async (values) => {
		if (await onLogin({
			email: values.email.trim(),
			password: values.password,
			redirectTo
		})) resetField("password");
	};
	if (!active) return null;
	return /* @__PURE__ */ jsxDEV("main", {
		className: "auth-shell",
		children: /* @__PURE__ */ jsxDEV("section", {
			className: "auth-panel",
			children: [/* @__PURE__ */ jsxDEV("div", {
				className: "auth-panel-header",
				children: [/* @__PURE__ */ jsxDEV("div", {
					className: "auth-brand-row",
					children: [/* @__PURE__ */ jsxDEV("div", {
						className: "auth-logo",
						children: /* @__PURE__ */ jsxDEV(Database, { className: "icon" }, void 0, false, {
							fileName: _jsxFileName$6,
							lineNumber: 54,
							columnNumber: 8
						}, void 0)
					}, void 0, false, {
						fileName: _jsxFileName$6,
						lineNumber: 53,
						columnNumber: 7
					}, void 0), /* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("h1", { children: "Hono Standard" }, void 0, false, {
						fileName: _jsxFileName$6,
						lineNumber: 57,
						columnNumber: 8
					}, void 0), /* @__PURE__ */ jsxDEV("p", { children: "ログイン" }, void 0, false, {
						fileName: _jsxFileName$6,
						lineNumber: 58,
						columnNumber: 8
					}, void 0)] }, void 0, true, {
						fileName: _jsxFileName$6,
						lineNumber: 56,
						columnNumber: 7
					}, void 0)]
				}, void 0, true, {
					fileName: _jsxFileName$6,
					lineNumber: 52,
					columnNumber: 6
				}, void 0), /* @__PURE__ */ jsxDEV("div", { className: "auth-accent-line" }, void 0, false, {
					fileName: _jsxFileName$6,
					lineNumber: 61,
					columnNumber: 6
				}, void 0)]
			}, void 0, true, {
				fileName: _jsxFileName$6,
				lineNumber: 51,
				columnNumber: 5
			}, void 0), /* @__PURE__ */ jsxDEV("form", {
				className: "auth-form",
				onSubmit: handleSubmit(submitLogin),
				children: [
					/* @__PURE__ */ jsxDEV("label", {
						htmlFor: "login-email",
						children: "Email"
					}, void 0, false, {
						fileName: _jsxFileName$6,
						lineNumber: 64,
						columnNumber: 6
					}, void 0),
					/* @__PURE__ */ jsxDEV("div", {
						className: "auth-input-wrap",
						children: [/* @__PURE__ */ jsxDEV(AtSign, { className: "icon" }, void 0, false, {
							fileName: _jsxFileName$6,
							lineNumber: 66,
							columnNumber: 7
						}, void 0), /* @__PURE__ */ jsxDEV("input", {
							id: "login-email",
							type: "email",
							placeholder: "admin@example.com",
							autoComplete: "username",
							...register("email", { required: true })
						}, void 0, false, {
							fileName: _jsxFileName$6,
							lineNumber: 67,
							columnNumber: 7
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName$6,
						lineNumber: 65,
						columnNumber: 6
					}, void 0),
					/* @__PURE__ */ jsxDEV("label", {
						htmlFor: "login-password",
						children: "Password"
					}, void 0, false, {
						fileName: _jsxFileName$6,
						lineNumber: 75,
						columnNumber: 6
					}, void 0),
					/* @__PURE__ */ jsxDEV("div", {
						className: "auth-input-wrap",
						children: [/* @__PURE__ */ jsxDEV(KeyRound, { className: "icon" }, void 0, false, {
							fileName: _jsxFileName$6,
							lineNumber: 77,
							columnNumber: 7
						}, void 0), /* @__PURE__ */ jsxDEV("input", {
							id: "login-password",
							type: "password",
							placeholder: "********",
							autoComplete: "current-password",
							...register("password", { required: true })
						}, void 0, false, {
							fileName: _jsxFileName$6,
							lineNumber: 78,
							columnNumber: 7
						}, void 0)]
					}, void 0, true, {
						fileName: _jsxFileName$6,
						lineNumber: 76,
						columnNumber: 6
					}, void 0),
					/* @__PURE__ */ jsxDEV("button", {
						type: "submit",
						className: "auth-submit",
						disabled: busy || isSubmitting,
						children: [
							/* @__PURE__ */ jsxDEV(Shield, { className: "icon" }, void 0, false, {
								fileName: _jsxFileName$6,
								lineNumber: 91,
								columnNumber: 7
							}, void 0),
							/* @__PURE__ */ jsxDEV("span", { children: "ログイン" }, void 0, false, {
								fileName: _jsxFileName$6,
								lineNumber: 92,
								columnNumber: 7
							}, void 0),
							/* @__PURE__ */ jsxDEV(ArrowRight, { className: "icon" }, void 0, false, {
								fileName: _jsxFileName$6,
								lineNumber: 93,
								columnNumber: 7
							}, void 0)
						]
					}, void 0, true, {
						fileName: _jsxFileName$6,
						lineNumber: 86,
						columnNumber: 6
					}, void 0)
				]
			}, void 0, true, {
				fileName: _jsxFileName$6,
				lineNumber: 63,
				columnNumber: 5
			}, void 0)]
		}, void 0, true, {
			fileName: _jsxFileName$6,
			lineNumber: 50,
			columnNumber: 4
		}, void 0)
	}, void 0, false, {
		fileName: _jsxFileName$6,
		lineNumber: 49,
		columnNumber: 3
	}, void 0);
};
//#endregion
//#region web/src/views/login-view.tsx
var _jsxFileName$5 = "/Users/y.noguchi/Code/hono-standard/web/src/views/login-view.tsx";
function LoginView() {
	const { authUser, authLoading, busy, loginWithPassword } = useAuth();
	const search = useSearch({ from: "/login" });
	if (authLoading) return /* @__PURE__ */ jsxDEV("main", {
		className: "center-shell",
		children: /* @__PURE__ */ jsxDEV("div", {
			className: "muted",
			children: "Loading session..."
		}, void 0, false, {
			fileName: _jsxFileName$5,
			lineNumber: 14,
			columnNumber: 5
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$5,
		lineNumber: 13,
		columnNumber: 4
	}, this);
	if (authUser) return /* @__PURE__ */ jsxDEV("main", {
		className: "center-shell",
		children: /* @__PURE__ */ jsxDEV("section", {
			className: "signed-in-panel",
			children: [
				/* @__PURE__ */ jsxDEV(Shield, { className: "icon" }, void 0, false, {
					fileName: _jsxFileName$5,
					lineNumber: 23,
					columnNumber: 6
				}, this),
				/* @__PURE__ */ jsxDEV("h1", { children: "Signed in" }, void 0, false, {
					fileName: _jsxFileName$5,
					lineNumber: 24,
					columnNumber: 6
				}, this),
				/* @__PURE__ */ jsxDEV("p", { children: [
					authUser.displayName,
					" (",
					authUser.role,
					")"
				] }, void 0, true, {
					fileName: _jsxFileName$5,
					lineNumber: 25,
					columnNumber: 6
				}, this),
				/* @__PURE__ */ jsxDEV(Link, {
					to: "/showcase",
					search: defaultShowcaseTableSearch,
					className: "auth-open-button",
					children: "Showcase"
				}, void 0, false, {
					fileName: _jsxFileName$5,
					lineNumber: 28,
					columnNumber: 6
				}, this),
				/* @__PURE__ */ jsxDEV(Link, {
					to: "/protected",
					className: "auth-open-button",
					children: "Protected sample"
				}, void 0, false, {
					fileName: _jsxFileName$5,
					lineNumber: 35,
					columnNumber: 6
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName$5,
			lineNumber: 22,
			columnNumber: 5
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$5,
		lineNumber: 21,
		columnNumber: 4
	}, this);
	return /* @__PURE__ */ jsxDEV(LoginDomainSection, {
		active: true,
		busy,
		redirectTo: search.redirect,
		onLogin: loginWithPassword
	}, void 0, false, {
		fileName: _jsxFileName$5,
		lineNumber: 44,
		columnNumber: 3
	}, this);
}
//#endregion
//#region web/src/routes/login-route.tsx
var loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	validateSearch: parseLoginSearch,
	component: LoginView
});
//#endregion
//#region web/src/views/protected-view.tsx
var _jsxFileName$4 = "/Users/y.noguchi/Code/hono-standard/web/src/views/protected-view.tsx";
function ProtectedView() {
	const { authUser, authLoading } = useAuth();
	const profileQuery = useProtectedProfileQuery(Boolean(authUser));
	if (authLoading) return /* @__PURE__ */ jsxDEV("main", {
		className: "center-shell",
		children: /* @__PURE__ */ jsxDEV("div", {
			className: "muted",
			children: "Checking session..."
		}, void 0, false, {
			fileName: _jsxFileName$4,
			lineNumber: 13,
			columnNumber: 5
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$4,
		lineNumber: 12,
		columnNumber: 4
	}, this);
	if (!authUser) return /* @__PURE__ */ jsxDEV("main", {
		className: "center-shell",
		children: /* @__PURE__ */ jsxDEV("section", {
			className: "signed-in-panel",
			children: [
				/* @__PURE__ */ jsxDEV(LockKeyhole, { className: "icon" }, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 22,
					columnNumber: 6
				}, this),
				/* @__PURE__ */ jsxDEV("h1", { children: "Login required" }, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 23,
					columnNumber: 6
				}, this),
				/* @__PURE__ */ jsxDEV("p", { children: "This sample route only displays its content after sign-in." }, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 24,
					columnNumber: 6
				}, this),
				/* @__PURE__ */ jsxDEV(Link, {
					to: "/login",
					search: { redirect: "/protected" },
					className: "auth-open-button",
					children: "Login"
				}, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 25,
					columnNumber: 6
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName$4,
			lineNumber: 21,
			columnNumber: 5
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$4,
		lineNumber: 20,
		columnNumber: 4
	}, this);
	return /* @__PURE__ */ jsxDEV("main", {
		className: "center-shell",
		children: /* @__PURE__ */ jsxDEV("section", {
			className: "signed-in-panel",
			children: [
				/* @__PURE__ */ jsxDEV(ShieldCheck, { className: "icon" }, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 40,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("h1", { children: "Protected route" }, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 41,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("p", { children: [
					authUser.displayName,
					" (",
					authUser.role,
					")"
				] }, void 0, true, {
					fileName: _jsxFileName$4,
					lineNumber: 42,
					columnNumber: 5
				}, this),
				/* @__PURE__ */ jsxDEV("p", { children: profileQuery.error ? "Server profile request failed." : profileQuery.data ? `Server confirmed ${profileQuery.data.email} as ${profileQuery.data.role}.` : "Server profile is loading." }, void 0, false, {
					fileName: _jsxFileName$4,
					lineNumber: 45,
					columnNumber: 5
				}, this)
			]
		}, void 0, true, {
			fileName: _jsxFileName$4,
			lineNumber: 39,
			columnNumber: 4
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$4,
		lineNumber: 38,
		columnNumber: 3
	}, this);
}
//#endregion
//#region web/src/routes/protected-route.tsx
var protectedRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/protected",
	component: ProtectedView
});
//#endregion
//#region web/src/showcase-settings-context.tsx
var _jsxFileName$3 = "/Users/y.noguchi/Code/hono-standard/web/src/showcase-settings-context.tsx";
var STORAGE_KEY = "hono-standard.showcase.settings.v1";
var ROOT_THEME_ATTRIBUTE = "data-showcase-page-theme";
var defaultSettings = {
	theme: "emerald",
	density: "comfortable",
	radius: "soft",
	fontSize: "medium"
};
var showcaseThemeOptions = [
	{
		value: "emerald",
		label: "Emerald",
		swatch: "#1f7a6a"
	},
	{
		value: "indigo",
		label: "Indigo",
		swatch: "#4f46e5"
	},
	{
		value: "rose",
		label: "Rose",
		swatch: "#be3455"
	},
	{
		value: "amber",
		label: "Amber",
		swatch: "#b7791f"
	},
	{
		value: "tokyo-night",
		label: "Tokyo Night",
		swatch: "#7aa2f7"
	},
	{
		value: "campfire",
		label: "Campfire",
		swatch: "linear-gradient(135deg, #120d0a 0%, #f97316 100%)"
	},
	{
		value: "terminal",
		label: "Terminal",
		swatch: "#39ff14"
	}
];
var showcaseDensityOptions = [
	{
		value: "compact",
		label: "Compact"
	},
	{
		value: "comfortable",
		label: "Comfortable"
	},
	{
		value: "spacious",
		label: "Spacious"
	}
];
var showcaseRadiusOptions = [
	{
		value: "sharp",
		label: "Sharp"
	},
	{
		value: "soft",
		label: "Soft"
	},
	{
		value: "round",
		label: "Round"
	}
];
var showcaseFontSizeOptions = [
	{
		value: "small",
		label: "Small"
	},
	{
		value: "medium",
		label: "Medium"
	},
	{
		value: "large",
		label: "Large"
	}
];
var themeTokens = {
	emerald: {
		accent: "#1f7a6a",
		accentStrong: "#176456",
		accentSoft: "#e6f5ef",
		accentSurface: "#f6fffb",
		accentBorder: "#a9cfc3",
		accentText: "#176456",
		focusRing: "rgba(31, 122, 106, 0.12)",
		page: "#f6f7f9",
		surface: "#ffffff",
		surfaceMuted: "#eef7f4",
		border: "#dde3ea",
		borderStrong: "#cbd7e2",
		ink: "#17202a",
		muted: "#52606f",
		mutedStrong: "#3b4754",
		onAccent: "#ffffff",
		shadow: "rgba(23, 32, 42, 0.08)",
		danger: "#9f1d1d",
		dangerSurface: "#fff1f1",
		dangerBorder: "#efb5b5",
		skeleton: "linear-gradient(90deg, #e8edf4, #f7f9fb, #e8edf4)",
		backdrop: "rgba(23, 32, 42, 0.4)"
	},
	indigo: {
		accent: "#4f46e5",
		accentStrong: "#3730a3",
		accentSoft: "#eef2ff",
		accentSurface: "#f8f9ff",
		accentBorder: "#c7d2fe",
		accentText: "#3730a3",
		focusRing: "rgba(79, 70, 229, 0.14)",
		page: "#f6f7f9",
		surface: "#ffffff",
		surfaceMuted: "#eef3f8",
		border: "#dde3ea",
		borderStrong: "#cbd7e2",
		ink: "#17202a",
		muted: "#52606f",
		mutedStrong: "#3b4754",
		onAccent: "#ffffff",
		shadow: "rgba(23, 32, 42, 0.08)",
		danger: "#9f1d1d",
		dangerSurface: "#fff1f1",
		dangerBorder: "#efb5b5",
		skeleton: "linear-gradient(90deg, #e8edf4, #f7f9fb, #e8edf4)",
		backdrop: "rgba(23, 32, 42, 0.4)"
	},
	rose: {
		accent: "#be3455",
		accentStrong: "#9f2544",
		accentSoft: "#fff1f4",
		accentSurface: "#fff8fa",
		accentBorder: "#f5b5c5",
		accentText: "#9f2544",
		focusRing: "rgba(190, 52, 85, 0.14)",
		page: "#f6f7f9",
		surface: "#ffffff",
		surfaceMuted: "#f7eef3",
		border: "#dde3ea",
		borderStrong: "#cbd7e2",
		ink: "#17202a",
		muted: "#52606f",
		mutedStrong: "#3b4754",
		onAccent: "#ffffff",
		shadow: "rgba(23, 32, 42, 0.08)",
		danger: "#9f1d1d",
		dangerSurface: "#fff1f1",
		dangerBorder: "#efb5b5",
		skeleton: "linear-gradient(90deg, #e8edf4, #f7f9fb, #e8edf4)",
		backdrop: "rgba(23, 32, 42, 0.4)"
	},
	amber: {
		accent: "#b7791f",
		accentStrong: "#8f5f18",
		accentSoft: "#fff7e8",
		accentSurface: "#fffaf0",
		accentBorder: "#f0d19b",
		accentText: "#7c5418",
		focusRing: "rgba(183, 121, 31, 0.16)",
		page: "#f6f7f9",
		surface: "#ffffff",
		surfaceMuted: "#f7f0e3",
		border: "#dde3ea",
		borderStrong: "#cbd7e2",
		ink: "#17202a",
		muted: "#52606f",
		mutedStrong: "#3b4754",
		onAccent: "#ffffff",
		shadow: "rgba(23, 32, 42, 0.08)",
		danger: "#9f1d1d",
		dangerSurface: "#fff1f1",
		dangerBorder: "#efb5b5",
		skeleton: "linear-gradient(90deg, #e8edf4, #f7f9fb, #e8edf4)",
		backdrop: "rgba(23, 32, 42, 0.4)"
	},
	"tokyo-night": {
		accent: "#7aa2f7",
		accentStrong: "#9eceff",
		accentSoft: "#1a2542",
		accentSurface: "#111a2f",
		accentBorder: "#2f4270",
		accentText: "#b4c9ff",
		focusRing: "rgba(122, 162, 247, 0.28)",
		page: "#0b1020",
		surface: "#111827",
		surfaceMuted: "#17213a",
		border: "#263452",
		borderStrong: "#3d527c",
		ink: "#d9e2ff",
		muted: "#9aa8c7",
		mutedStrong: "#c0caf5",
		onAccent: "#08111f",
		shadow: "rgba(0, 0, 0, 0.34)",
		danger: "#ff9e9e",
		dangerSurface: "#351b25",
		dangerBorder: "#733044",
		skeleton: "linear-gradient(90deg, #17213a, #233253, #17213a)",
		backdrop: "rgba(3, 7, 18, 0.72)"
	},
	campfire: {
		accent: "#f97316",
		accentStrong: "#fb923c",
		accentSoft: "#3a2013",
		accentSurface: "#1c130f",
		accentBorder: "#7c3c1c",
		accentText: "#fed7aa",
		focusRing: "rgba(249, 115, 22, 0.28)",
		page: "#100c0a",
		surface: "#19110d",
		surfaceMuted: "#26170f",
		border: "#3b2619",
		borderStrong: "#8a4a24",
		ink: "#fff3e4",
		muted: "#c9a98f",
		mutedStrong: "#f4c899",
		onAccent: "#160a03",
		shadow: "rgba(0, 0, 0, 0.38)",
		danger: "#fca5a5",
		dangerSurface: "#361818",
		dangerBorder: "#7f2d2d",
		skeleton: "linear-gradient(90deg, #26170f, #3a2013, #26170f)",
		backdrop: "rgba(9, 5, 3, 0.74)"
	},
	terminal: {
		accent: "#39ff14",
		accentStrong: "#7cff5f",
		accentSoft: "#0d2f13",
		accentSurface: "#061608",
		accentBorder: "#1d7a2a",
		accentText: "#b9ffad",
		focusRing: "rgba(57, 255, 20, 0.28)",
		page: "#030703",
		surface: "#071107",
		surfaceMuted: "#0b1f0c",
		border: "#163a17",
		borderStrong: "#2f8a31",
		ink: "#d9ffd4",
		muted: "#82b879",
		mutedStrong: "#b2f5a5",
		onAccent: "#021802",
		shadow: "rgba(0, 0, 0, 0.46)",
		danger: "#ff6b6b",
		dangerSurface: "#2b1010",
		dangerBorder: "#7a2727",
		skeleton: "linear-gradient(90deg, #0b1f0c, #123a15, #0b1f0c)",
		backdrop: "rgba(0, 6, 0, 0.78)"
	}
};
var densityTokens = {
	compact: {
		gap: "10px",
		gapTight: "7px",
		gapLoose: "20px",
		sectionGap: "12px",
		cardPadding: "14px",
		controlHeight: "34px",
		inputHeight: "36px",
		tablePadding: "9px 11px"
	},
	comfortable: {
		gap: "16px",
		gapTight: "10px",
		gapLoose: "32px",
		sectionGap: "16px",
		cardPadding: "20px",
		controlHeight: "38px",
		inputHeight: "40px",
		tablePadding: "12px 14px"
	},
	spacious: {
		gap: "22px",
		gapTight: "14px",
		gapLoose: "44px",
		sectionGap: "22px",
		cardPadding: "24px",
		controlHeight: "44px",
		inputHeight: "46px",
		tablePadding: "15px 18px"
	}
};
var radiusTokens = {
	sharp: {
		controlRadius: "3px",
		cardRadius: "4px",
		panelRadius: "4px"
	},
	soft: {
		controlRadius: "8px",
		cardRadius: "8px",
		panelRadius: "8px"
	},
	round: {
		controlRadius: "8px",
		cardRadius: "8px",
		panelRadius: "8px"
	}
};
var fontSizeTokens = {
	small: {
		base: "14px",
		small: "12px",
		heading: "22px",
		cardTitle: "17px"
	},
	medium: {
		base: "16px",
		small: "13px",
		heading: "24px",
		cardTitle: "18px"
	},
	large: {
		base: "17px",
		small: "14px",
		heading: "27px",
		cardTitle: "20px"
	}
};
var ShowcaseSettingsContext = createContext(null);
function ShowcaseSettingsProvider({ children }) {
	const [settings, setSettings] = useState(readStoredSettings);
	useEffect(() => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	}, [settings]);
	const showcaseStyle = useMemo(() => getShowcaseStyle(settings), [settings]);
	useEffect(() => {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		const previousVariables = new Map(Object.keys(showcaseStyle).map((name) => [name, root.style.getPropertyValue(name)]));
		const previousTheme = root.getAttribute(ROOT_THEME_ATTRIBUTE);
		const previousColorScheme = root.style.colorScheme;
		for (const [name, value] of Object.entries(showcaseStyle)) root.style.setProperty(name, value);
		root.setAttribute(ROOT_THEME_ATTRIBUTE, settings.theme);
		root.style.colorScheme = isDarkShowcaseTheme(settings.theme) ? "dark" : "light";
		return () => {
			for (const [name, value] of previousVariables) if (value) root.style.setProperty(name, value);
			else root.style.removeProperty(name);
			if (previousTheme) root.setAttribute(ROOT_THEME_ATTRIBUTE, previousTheme);
			else root.removeAttribute(ROOT_THEME_ATTRIBUTE);
			root.style.colorScheme = previousColorScheme;
		};
	}, [settings.theme, showcaseStyle]);
	const value = useMemo(() => ({
		settings,
		setTheme: (theme) => setSettings((current) => ({
			...current,
			theme
		})),
		setDensity: (density) => setSettings((current) => ({
			...current,
			density
		})),
		setRadius: (radius) => setSettings((current) => ({
			...current,
			radius
		})),
		setFontSize: (fontSize) => setSettings((current) => ({
			...current,
			fontSize
		})),
		resetSettings: () => setSettings(defaultSettings),
		showcaseStyle
	}), [settings, showcaseStyle]);
	return /* @__PURE__ */ jsxDEV(ShowcaseSettingsContext.Provider, {
		value,
		children
	}, void 0, false, {
		fileName: _jsxFileName$3,
		lineNumber: 481,
		columnNumber: 3
	}, this);
}
function useShowcaseSettings() {
	const context = useContext(ShowcaseSettingsContext);
	if (!context) throw new Error("useShowcaseSettings must be used inside ShowcaseSettingsProvider");
	return context;
}
function readStoredSettings() {
	if (typeof window === "undefined") return defaultSettings;
	const rawSettings = window.localStorage.getItem(STORAGE_KEY);
	if (!rawSettings) return defaultSettings;
	try {
		const parsed = JSON.parse(rawSettings);
		return {
			theme: isShowcaseTheme(parsed.theme) ? parsed.theme : defaultSettings.theme,
			density: isShowcaseDensity(parsed.density) ? parsed.density : defaultSettings.density,
			radius: isShowcaseRadius(parsed.radius) ? parsed.radius : defaultSettings.radius,
			fontSize: isShowcaseFontSize(parsed.fontSize) ? parsed.fontSize : defaultSettings.fontSize
		};
	} catch {
		return defaultSettings;
	}
}
function getShowcaseStyle(settings) {
	const theme = themeTokens[settings.theme];
	const density = densityTokens[settings.density];
	const radius = radiusTokens[settings.radius];
	const fontSize = fontSizeTokens[settings.fontSize];
	return {
		"--showcase-accent": theme.accent,
		"--showcase-accent-strong": theme.accentStrong,
		"--showcase-accent-soft": theme.accentSoft,
		"--showcase-accent-surface": theme.accentSurface,
		"--showcase-accent-border": theme.accentBorder,
		"--showcase-accent-text": theme.accentText,
		"--showcase-focus-ring": theme.focusRing,
		"--showcase-page": theme.page,
		"--showcase-surface": theme.surface,
		"--showcase-surface-muted": theme.surfaceMuted,
		"--showcase-border": theme.border,
		"--showcase-border-strong": theme.borderStrong,
		"--showcase-ink": theme.ink,
		"--showcase-muted": theme.muted,
		"--showcase-muted-strong": theme.mutedStrong,
		"--showcase-on-accent": theme.onAccent,
		"--showcase-shadow": theme.shadow,
		"--showcase-danger": theme.danger,
		"--showcase-danger-surface": theme.dangerSurface,
		"--showcase-danger-border": theme.dangerBorder,
		"--showcase-skeleton": theme.skeleton,
		"--showcase-backdrop": theme.backdrop,
		"--showcase-gap": density.gap,
		"--showcase-gap-tight": density.gapTight,
		"--showcase-gap-loose": density.gapLoose,
		"--showcase-section-gap": density.sectionGap,
		"--showcase-card-padding": density.cardPadding,
		"--showcase-control-height": density.controlHeight,
		"--showcase-input-height": density.inputHeight,
		"--showcase-table-padding": density.tablePadding,
		"--showcase-control-radius": radius.controlRadius,
		"--showcase-card-radius": radius.cardRadius,
		"--showcase-panel-radius": radius.panelRadius,
		"--showcase-font-size": fontSize.base,
		"--showcase-font-size-small": fontSize.small,
		"--showcase-heading-size": fontSize.heading,
		"--showcase-card-title-size": fontSize.cardTitle
	};
}
function isShowcaseTheme(value) {
	return showcaseThemeOptions.some((option) => option.value === value);
}
function isDarkShowcaseTheme(theme) {
	return theme === "tokyo-night" || theme === "campfire" || theme === "terminal";
}
function isShowcaseDensity(value) {
	return showcaseDensityOptions.some((option) => option.value === value);
}
function isShowcaseRadius(value) {
	return showcaseRadiusOptions.some((option) => option.value === value);
}
function isShowcaseFontSize(value) {
	return showcaseFontSizeOptions.some((option) => option.value === value);
}
//#endregion
//#region web/src/views/showcase-view.tsx
var _jsxFileName$2 = "/Users/y.noguchi/Code/hono-standard/web/src/views/showcase-view.tsx";
var visibleComponents = [
	"Button",
	"IconButton",
	"Badge",
	"Alert",
	"NotificationToast",
	"Card",
	"Avatar",
	"Input",
	"InputGroup",
	"InputOtp",
	"Textarea",
	"Select",
	"Combobox",
	"Checkbox",
	"RadioGroup",
	"Switch",
	"Tabs",
	"Breadcrumb",
	"Accordion",
	"DropdownMenu",
	"Pagination",
	"ViewSwitcher",
	"Dialog",
	"Drawer",
	"Popover",
	"Tooltip",
	"Progress",
	"Skeleton",
	"Spinner",
	"Table",
	"MiniTable",
	"List",
	"FileTree",
	"DateFormat",
	"NumberFormat"
];
function ShowcaseView() {
	return /* @__PURE__ */ jsxDEV(ShowcaseContent, {}, void 0, false, {
		fileName: _jsxFileName$2,
		lineNumber: 100,
		columnNumber: 9
	}, this);
}
function ShowcaseContent() {
	const search = useSearch({ from: "/showcase" });
	const navigate = useNavigate({ from: "/showcase" });
	const [progress, setProgress] = useState(33);
	const [selectedFramework, setSelectedFramework] = useState("React");
	const [notificationsEnabled, setNotificationsEnabled] = useState(true);
	const [acceptedTerms, setAcceptedTerms] = useState(true);
	const [selectedPlan, setSelectedPlan] = useState("team");
	const [activeTab, setActiveTab] = useState("account");
	const [openAccordion, setOpenAccordion] = useState("tokens");
	const [menuOpen, setMenuOpen] = useState(false);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [activePage, setActivePage] = useState(2);
	const [activeView, setActiveView] = useState("grid");
	const [copied, setCopied] = useState(false);
	const { settings, setTheme, setDensity, setRadius, setFontSize, resetSettings, showcaseStyle } = useShowcaseSettings();
	const tableSorting = useMemo(() => search.sortBy ? [{
		id: search.sortBy,
		desc: search.sortDir === "desc"
	}] : [], [search.sortBy, search.sortDir]);
	const table = useReactTable({
		data: useMemo(() => visibleComponents.map((component) => ({
			component,
			category: getComponentCategory(component),
			status: getComponentStatus(component)
		})), []),
		columns: useMemo(() => [
			{
				accessorKey: "component",
				header: "Component"
			},
			{
				accessorKey: "category",
				header: "Category"
			},
			{
				accessorKey: "status",
				header: "Status"
			}
		], []),
		state: {
			sorting: tableSorting,
			pagination: {
				pageIndex: search.page - 1,
				pageSize: search.pageSize
			}
		},
		onSortingChange: (updater) => {
			const primarySort = (typeof updater === "function" ? updater(tableSorting) : updater)[0];
			if (!primarySort || !isShowcaseSortField(primarySort.id)) {
				updateTableSearch({
					page: 1,
					sortBy: void 0,
					sortDir: void 0
				});
				return;
			}
			updateTableSearch({
				page: 1,
				sortBy: primarySort.id,
				sortDir: primarySort.desc ? "desc" : "asc"
			});
		},
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
	});
	const visiblePageNumbers = getVisiblePageNumbers(table.getPageCount(), search.page);
	function updateTableSearch(nextSearch) {
		const scrollPosition = typeof window === "undefined" ? null : {
			x: window.scrollX,
			y: window.scrollY
		};
		return navigate({
			replace: true,
			resetScroll: false,
			search: (previous) => ({
				...previous,
				...nextSearch
			})
		}).then(() => {
			if (!scrollPosition) return;
			window.requestAnimationFrame(() => {
				window.scrollTo(scrollPosition.x, scrollPosition.y);
			});
		});
	}
	return /* @__PURE__ */ jsxDEV("main", {
		className: "showcase-shell component-showcase",
		style: showcaseStyle,
		"data-showcase-theme": settings.theme,
		"data-showcase-density": settings.density,
		"data-showcase-radius": settings.radius,
		"data-showcase-font-size": settings.fontSize,
		children: [
			/* @__PURE__ */ jsxDEV("section", {
				className: "component-showcase-header",
				children: [
					/* @__PURE__ */ jsxDEV("div", {
						className: "showcase-kicker",
						children: [/* @__PURE__ */ jsxDEV(Grid2X2, { className: "icon" }, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 234,
							columnNumber: 6
						}, this), /* @__PURE__ */ jsxDEV("span", { children: [visibleComponents.length, " components"] }, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 235,
							columnNumber: 6
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 233,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("h1", { children: "Component Showcase" }, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 237,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("p", { children: "Demonstrating the components from the template design system." }, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 238,
						columnNumber: 5
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 232,
				columnNumber: 4
			}, this),
			/* @__PURE__ */ jsxDEV("section", {
				className: "showcase-settings-panel",
				"aria-labelledby": "appearance-heading",
				children: [
					/* @__PURE__ */ jsxDEV("div", {
						className: "showcase-settings-header",
						children: [/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("h2", {
							id: "appearance-heading",
							children: "Appearance Controls"
						}, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 247,
							columnNumber: 7
						}, this), /* @__PURE__ */ jsxDEV("p", { children: "Theme tokens persisted by React Context and localStorage." }, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 248,
							columnNumber: 7
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 246,
							columnNumber: 6
						}, this), /* @__PURE__ */ jsxDEV("button", {
							type: "button",
							className: "demo-button variant-outline",
							onClick: resetSettings,
							children: "Reset"
						}, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 250,
							columnNumber: 6
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 245,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("div", {
						className: "settings-grid",
						children: [
							/* @__PURE__ */ jsxDEV("label", {
								className: "settings-field",
								htmlFor: "showcase-theme",
								children: [/* @__PURE__ */ jsxDEV("span", { children: "Theme Color" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 260,
									columnNumber: 7
								}, this), /* @__PURE__ */ jsxDEV("select", {
									id: "showcase-theme",
									value: settings.theme,
									onChange: (event) => setTheme(event.target.value),
									children: showcaseThemeOptions.map((option) => /* @__PURE__ */ jsxDEV("option", {
										value: option.value,
										children: option.label
									}, option.value, false, {
										fileName: _jsxFileName$2,
										lineNumber: 269,
										columnNumber: 9
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 261,
									columnNumber: 7
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 259,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "settings-field",
								children: [/* @__PURE__ */ jsxDEV("span", { children: "Density" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 276,
									columnNumber: 7
								}, this), /* @__PURE__ */ jsxDEV("div", {
									className: "settings-button-row",
									children: showcaseDensityOptions.map((option) => /* @__PURE__ */ jsxDEV("button", {
										type: "button",
										className: settings.density === option.value ? "active" : "",
										"aria-pressed": settings.density === option.value,
										onClick: () => setDensity(option.value),
										children: option.label
									}, option.value, false, {
										fileName: _jsxFileName$2,
										lineNumber: 279,
										columnNumber: 9
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 277,
									columnNumber: 7
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 275,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "settings-field",
								children: [/* @__PURE__ */ jsxDEV("span", { children: "Corner Radius" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 292,
									columnNumber: 7
								}, this), /* @__PURE__ */ jsxDEV("div", {
									className: "settings-button-row",
									children: showcaseRadiusOptions.map((option) => /* @__PURE__ */ jsxDEV("button", {
										type: "button",
										className: settings.radius === option.value ? "active" : "",
										"aria-pressed": settings.radius === option.value,
										onClick: () => setRadius(option.value),
										children: option.label
									}, option.value, false, {
										fileName: _jsxFileName$2,
										lineNumber: 295,
										columnNumber: 9
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 293,
									columnNumber: 7
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 291,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "settings-field",
								children: [/* @__PURE__ */ jsxDEV("span", { children: "Font Size" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 308,
									columnNumber: 7
								}, this), /* @__PURE__ */ jsxDEV("div", {
									className: "settings-button-row",
									children: showcaseFontSizeOptions.map((option) => /* @__PURE__ */ jsxDEV("button", {
										type: "button",
										className: settings.fontSize === option.value ? "active" : "",
										"aria-pressed": settings.fontSize === option.value,
										onClick: () => setFontSize(option.value),
										children: option.label
									}, option.value, false, {
										fileName: _jsxFileName$2,
										lineNumber: 311,
										columnNumber: 9
									}, this))
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 309,
									columnNumber: 7
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 307,
								columnNumber: 6
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 258,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("div", {
						className: "theme-preview-row",
						children: showcaseThemeOptions.map((option) => /* @__PURE__ */ jsxDEV("button", {
							type: "button",
							className: settings.theme === option.value ? "theme-swatch active" : "theme-swatch",
							"aria-label": option.label,
							"aria-pressed": settings.theme === option.value,
							onClick: () => setTheme(option.value),
							style: { "--swatch-color": option.swatch }
						}, option.value, false, {
							fileName: _jsxFileName$2,
							lineNumber: 326,
							columnNumber: 7
						}, this))
					}, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 324,
						columnNumber: 5
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 241,
				columnNumber: 4
			}, this),
			/* @__PURE__ */ jsxDEV("section", {
				className: "showcase-section",
				"aria-labelledby": "actions-heading",
				children: [
					/* @__PURE__ */ jsxDEV("h2", {
						id: "actions-heading",
						children: "Actions & Feedback"
					}, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 348,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("div", {
						className: "button-row",
						children: [
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button primary",
								children: [/* @__PURE__ */ jsxDEV(Check, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 351,
									columnNumber: 7
								}, this), "Default"]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 350,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button secondary",
								children: [/* @__PURE__ */ jsxDEV(Settings, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 355,
									columnNumber: 7
								}, this), "Secondary"]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 354,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button destructive",
								children: [/* @__PURE__ */ jsxDEV(X, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 359,
									columnNumber: 7
								}, this), "Destructive"]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 358,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button variant-outline",
								children: [/* @__PURE__ */ jsxDEV(SlidersHorizontal, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 363,
									columnNumber: 7
								}, this), "Outline"]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 362,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button ghost",
								children: "Ghost"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 366,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button link",
								children: "Link"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 369,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button primary",
								disabled: true,
								children: "Disabled"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 372,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-icon-button",
								"aria-label": "More actions",
								title: "More actions",
								children: /* @__PURE__ */ jsxDEV(MoreHorizontal, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 381,
									columnNumber: 7
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 375,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-icon-button",
								"aria-label": "Notifications",
								title: "Notifications",
								children: /* @__PURE__ */ jsxDEV(Bell, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 389,
									columnNumber: 7
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 383,
								columnNumber: 6
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 349,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("div", {
						className: "badge-row",
						children: [
							/* @__PURE__ */ jsxDEV("span", {
								className: "demo-badge default",
								children: "Default"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 393,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("span", {
								className: "demo-badge secondary",
								children: "Secondary"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 394,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("span", {
								className: "demo-badge variant-outline",
								children: "Outline"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 395,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("span", {
								className: "demo-badge destructive",
								children: "Destructive"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 396,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("span", {
								className: "demo-badge success",
								children: "Success"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 397,
								columnNumber: 6
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 392,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("div", {
						className: "feedback-grid",
						children: [
							/* @__PURE__ */ jsxDEV("div", {
								className: "demo-alert info",
								children: [/* @__PURE__ */ jsxDEV(Info, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 401,
									columnNumber: 7
								}, this), /* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("strong", { children: "System notice" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 403,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("span", { children: "Background sync is current." }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 404,
									columnNumber: 8
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 402,
									columnNumber: 7
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 400,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "demo-alert success",
								children: [/* @__PURE__ */ jsxDEV(ShieldCheck, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 408,
									columnNumber: 7
								}, this), /* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("strong", { children: "Verified" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 410,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("span", { children: "Production checks completed." }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 411,
									columnNumber: 8
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 409,
									columnNumber: 7
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 407,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "demo-toast",
								children: [
									/* @__PURE__ */ jsxDEV(Bell, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 415,
										columnNumber: 7
									}, this),
									/* @__PURE__ */ jsxDEV("span", { children: "Notification toast" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 416,
										columnNumber: 7
									}, this),
									/* @__PURE__ */ jsxDEV("button", {
										type: "button",
										"aria-label": "Dismiss notification",
										children: /* @__PURE__ */ jsxDEV(X, { className: "icon" }, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 418,
											columnNumber: 8
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 417,
										columnNumber: 7
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 414,
								columnNumber: 6
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 399,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("div", {
						className: "feedback-grid compact",
						children: [
							/* @__PURE__ */ jsxDEV("div", {
								className: "progress-block",
								children: [
									/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "Usage" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 425,
										columnNumber: 8
									}, this), /* @__PURE__ */ jsxDEV("strong", { children: [progress, "%"] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 426,
										columnNumber: 8
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 424,
										columnNumber: 7
									}, this),
									/* @__PURE__ */ jsxDEV("div", {
										className: "progress-track",
										children: /* @__PURE__ */ jsxDEV("div", {
											className: "progress-fill",
											style: { width: `${progress}%` }
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 429,
											columnNumber: 8
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 428,
										columnNumber: 7
									}, this),
									/* @__PURE__ */ jsxDEV("button", {
										type: "button",
										className: "demo-button secondary",
										onClick: () => setProgress((value) => (value + 10) % 110),
										children: "Simulate Progress"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 434,
										columnNumber: 7
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 423,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "skeleton-stack",
								role: "img",
								"aria-label": "Skeleton preview",
								children: [
									/* @__PURE__ */ jsxDEV("span", {}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 447,
										columnNumber: 7
									}, this),
									/* @__PURE__ */ jsxDEV("span", {}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 448,
										columnNumber: 7
									}, this),
									/* @__PURE__ */ jsxDEV("span", {}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 449,
										columnNumber: 7
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 442,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "spinner-row",
								children: [/* @__PURE__ */ jsxDEV(LoaderCircle, { className: "spinner-icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 452,
									columnNumber: 7
								}, this), /* @__PURE__ */ jsxDEV("span", { children: "Loading state" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 453,
									columnNumber: 7
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 451,
								columnNumber: 6
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 422,
						columnNumber: 5
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 347,
				columnNumber: 4
			}, this),
			/* @__PURE__ */ jsxDEV("section", {
				className: "showcase-section",
				"aria-labelledby": "cards-heading",
				children: [/* @__PURE__ */ jsxDEV("h2", {
					id: "cards-heading",
					children: "Cards & Content"
				}, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 459,
					columnNumber: 5
				}, this), /* @__PURE__ */ jsxDEV("div", {
					className: "component-grid",
					children: [
						/* @__PURE__ */ jsxDEV("article", {
							className: "demo-card",
							children: [
								/* @__PURE__ */ jsxDEV("header", { children: [/* @__PURE__ */ jsxDEV("h3", { children: "Project Update" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 463,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("p", { children: "Latest milestones achieved this week." }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 464,
									columnNumber: 8
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 462,
									columnNumber: 7
								}, this),
								/* @__PURE__ */ jsxDEV("p", { children: "The template keeps routing, querying, table primitives, optional auth, and a compact Hono API surface." }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 466,
									columnNumber: 7
								}, this),
								/* @__PURE__ */ jsxDEV("footer", { children: [/* @__PURE__ */ jsxDEV("button", {
									type: "button",
									className: "demo-button variant-outline",
									children: "Cancel"
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 471,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("button", {
									type: "button",
									className: "demo-button primary",
									children: "Deploy"
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 474,
									columnNumber: 8
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 470,
									columnNumber: 7
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 461,
							columnNumber: 6
						}, this),
						/* @__PURE__ */ jsxDEV("article", {
							className: "demo-card highlighted",
							children: [
								/* @__PURE__ */ jsxDEV("header", {
									className: "card-header-row",
									children: [/* @__PURE__ */ jsxDEV("h3", { children: "Statistics" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 482,
										columnNumber: 8
									}, this), /* @__PURE__ */ jsxDEV("span", {
										className: "demo-badge variant-outline",
										children: "Live"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 483,
										columnNumber: 8
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 481,
									columnNumber: 7
								}, this),
								/* @__PURE__ */ jsxDEV("div", {
									className: "metric-row",
									children: [/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "Revenue" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 487,
										columnNumber: 9
									}, this), /* @__PURE__ */ jsxDEV("strong", { children: new Intl.NumberFormat("en-US").format(42800) }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 488,
										columnNumber: 9
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 486,
										columnNumber: 8
									}, this), /* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "Updated" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 491,
										columnNumber: 9
									}, this), /* @__PURE__ */ jsxDEV("strong", { children: new Intl.DateTimeFormat("en-US", {
										month: "short",
										day: "numeric"
									}).format(/* @__PURE__ */ new Date("2026-06-13T00:00:00+09:00")) }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 492,
										columnNumber: 9
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 490,
										columnNumber: 8
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 485,
									columnNumber: 7
								}, this),
								/* @__PURE__ */ jsxDEV("button", {
									type: "button",
									className: "demo-button secondary full",
									onClick: () => {
										setCopied(true);
										window.setTimeout(() => setCopied(false), 1200);
									},
									children: [/* @__PURE__ */ jsxDEV(Copy, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 508,
										columnNumber: 8
									}, this), copied ? "Copied" : "Copy Report"]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 500,
									columnNumber: 7
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 480,
							columnNumber: 6
						}, this),
						/* @__PURE__ */ jsxDEV("article", {
							className: "demo-card profile-card",
							children: [/* @__PURE__ */ jsxDEV("header", {
								className: "profile-header",
								children: [/* @__PURE__ */ jsxDEV("div", {
									className: "avatar",
									children: "TU"
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 515,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("h3", { children: "Team Profile" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 517,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("p", { children: "@template-team - Verified" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 518,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 516,
									columnNumber: 8
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 514,
								columnNumber: 7
							}, this), /* @__PURE__ */ jsxDEV("ul", {
								className: "demo-list",
								children: [
									/* @__PURE__ */ jsxDEV("li", { children: [/* @__PURE__ */ jsxDEV(Mail, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 523,
										columnNumber: 9
									}, this), /* @__PURE__ */ jsxDEV("span", { children: "template@example.com" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 524,
										columnNumber: 9
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 522,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("li", { children: [/* @__PURE__ */ jsxDEV(Calendar, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 527,
										columnNumber: 9
									}, this), /* @__PURE__ */ jsxDEV("span", { children: "Joined Jun 2026" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 528,
										columnNumber: 9
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 526,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("li", { children: [/* @__PURE__ */ jsxDEV(Star, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 531,
										columnNumber: 9
									}, this), /* @__PURE__ */ jsxDEV("span", { children: "Design system maintainer" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 532,
										columnNumber: 9
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 530,
										columnNumber: 8
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 521,
								columnNumber: 7
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 513,
							columnNumber: 6
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 460,
					columnNumber: 5
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 458,
				columnNumber: 4
			}, this),
			/* @__PURE__ */ jsxDEV("section", {
				className: "showcase-section",
				"aria-labelledby": "forms-heading",
				children: [/* @__PURE__ */ jsxDEV("h2", {
					id: "forms-heading",
					children: "Forms & Selection"
				}, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 540,
					columnNumber: 5
				}, this), /* @__PURE__ */ jsxDEV("div", {
					className: "demo-card form-card",
					children: [/* @__PURE__ */ jsxDEV("div", {
						className: "form-column",
						children: [
							/* @__PURE__ */ jsxDEV("label", {
								htmlFor: "showcase-email",
								children: "Email Address"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 543,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "input-group",
								children: [/* @__PURE__ */ jsxDEV(Mail, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 545,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("input", {
									id: "showcase-email",
									placeholder: "name@example.com",
									type: "email"
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 546,
									columnNumber: 8
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 544,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("label", {
								htmlFor: "showcase-framework",
								children: "Framework"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 553,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("select", {
								id: "showcase-framework",
								className: "demo-input",
								value: selectedFramework,
								onChange: (event) => setSelectedFramework(event.target.value),
								children: [
									/* @__PURE__ */ jsxDEV("option", { children: "React" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 560,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("option", { children: "SvelteKit" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 561,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("option", { children: "Astro" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 562,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("option", { children: "Remix" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 563,
										columnNumber: 8
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 554,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("label", {
								htmlFor: "showcase-search",
								children: "Searchable Select"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 566,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "input-group",
								children: [
									/* @__PURE__ */ jsxDEV(Search, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 568,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("input", {
										id: "showcase-search",
										defaultValue: selectedFramework
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 569,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV(ChevronDown, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 570,
										columnNumber: 8
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 567,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("label", {
								htmlFor: "showcase-notes",
								children: "Textarea"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 573,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("textarea", {
								id: "showcase-notes",
								className: "demo-textarea",
								defaultValue: "Reusable form controls with compact spacing."
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 574,
								columnNumber: 7
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 542,
						columnNumber: 6
					}, this), /* @__PURE__ */ jsxDEV("div", {
						className: "switch-column",
						children: [
							/* @__PURE__ */ jsxDEV("label", {
								className: "switch-row",
								children: [/* @__PURE__ */ jsxDEV("input", {
									type: "checkbox",
									checked: acceptedTerms,
									onChange: (event) => setAcceptedTerms(event.target.checked)
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 582,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("span", { children: "Checkbox" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 587,
									columnNumber: 8
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 581,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("label", {
								className: "switch-row",
								children: [/* @__PURE__ */ jsxDEV("input", {
									type: "checkbox",
									checked: notificationsEnabled,
									onChange: (event) => setNotificationsEnabled(event.target.checked)
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 590,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("span", { children: "Switch" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 597,
									columnNumber: 8
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 589,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("fieldset", {
								className: "radio-group",
								children: [
									/* @__PURE__ */ jsxDEV("legend", { children: "Radio Group" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 600,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("label", { children: [/* @__PURE__ */ jsxDEV("input", {
										type: "radio",
										name: "plan",
										value: "starter",
										checked: selectedPlan === "starter",
										onChange: (event) => setSelectedPlan(event.target.value)
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 602,
										columnNumber: 9
									}, this), /* @__PURE__ */ jsxDEV("span", { children: "Starter" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 609,
										columnNumber: 9
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 601,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("label", { children: [/* @__PURE__ */ jsxDEV("input", {
										type: "radio",
										name: "plan",
										value: "team",
										checked: selectedPlan === "team",
										onChange: (event) => setSelectedPlan(event.target.value)
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 612,
										columnNumber: 9
									}, this), /* @__PURE__ */ jsxDEV("span", { children: "Team" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 619,
										columnNumber: 9
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 611,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("label", { children: [/* @__PURE__ */ jsxDEV("input", {
										type: "radio",
										name: "plan",
										value: "enterprise",
										checked: selectedPlan === "enterprise",
										onChange: (event) => setSelectedPlan(event.target.value)
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 622,
										columnNumber: 9
									}, this), /* @__PURE__ */ jsxDEV("span", { children: "Enterprise" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 629,
										columnNumber: 9
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 621,
										columnNumber: 8
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 599,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("fieldset", {
								className: "otp-row",
								children: [
									/* @__PURE__ */ jsxDEV("legend", {
										className: "sr-only",
										children: "One-time passcode"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 633,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("input", {
										"aria-label": "Digit 1",
										defaultValue: "2",
										inputMode: "numeric"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 634,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("input", {
										"aria-label": "Digit 2",
										defaultValue: "4",
										inputMode: "numeric"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 639,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("input", {
										"aria-label": "Digit 3",
										defaultValue: "8",
										inputMode: "numeric"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 644,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("input", {
										"aria-label": "Digit 4",
										defaultValue: "6",
										inputMode: "numeric"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 649,
										columnNumber: 8
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 632,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "scale-input",
								children: [/* @__PURE__ */ jsxDEV("label", {
									htmlFor: "showcase-scale",
									children: "Scale Input"
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 656,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("input", {
									id: "showcase-scale",
									type: "range",
									min: "0",
									max: "100"
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 657,
									columnNumber: 8
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 655,
								columnNumber: 7
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 580,
						columnNumber: 6
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 541,
					columnNumber: 5
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 539,
				columnNumber: 4
			}, this),
			/* @__PURE__ */ jsxDEV("section", {
				className: "showcase-section",
				"aria-labelledby": "nav-heading",
				children: [
					/* @__PURE__ */ jsxDEV("h2", {
						id: "nav-heading",
						children: "Navigation & Disclosure"
					}, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 664,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("nav", {
						className: "breadcrumb",
						"aria-label": "Breadcrumb",
						children: [
							/* @__PURE__ */ jsxDEV("a", {
								href: "/",
								children: "Home"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 666,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("span", { children: "/" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 667,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("a", {
								href: "/showcase",
								children: "Showcase"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 668,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("span", { children: "/" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 669,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("strong", { children: "Components" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 670,
								columnNumber: 6
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 665,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("div", {
						className: "nav-layout-grid",
						children: [/* @__PURE__ */ jsxDEV("div", {
							className: "tabs-card",
							children: [/* @__PURE__ */ jsxDEV("div", {
								className: "tabs-list",
								role: "tablist",
								"aria-label": "Example tabs",
								children: [
									/* @__PURE__ */ jsxDEV("button", {
										type: "button",
										role: "tab",
										className: activeTab === "account" ? "active" : "",
										"aria-selected": activeTab === "account",
										onClick: () => setActiveTab("account"),
										children: "Account"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 675,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("button", {
										type: "button",
										role: "tab",
										className: activeTab === "password" ? "active" : "",
										"aria-selected": activeTab === "password",
										onClick: () => setActiveTab("password"),
										children: "Password"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 684,
										columnNumber: 8
									}, this),
									/* @__PURE__ */ jsxDEV("button", {
										type: "button",
										role: "tab",
										className: activeTab === "settings" ? "active" : "",
										"aria-selected": activeTab === "settings",
										onClick: () => setActiveTab("settings"),
										children: "Settings"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 693,
										columnNumber: 8
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 674,
								columnNumber: 7
							}, this), /* @__PURE__ */ jsxDEV("div", {
								className: "tab-content",
								children: [
									activeTab === "account" ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
										/* @__PURE__ */ jsxDEV("h3", { children: "Account Information" }, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 706,
											columnNumber: 10
										}, this),
										/* @__PURE__ */ jsxDEV("input", {
											className: "demo-input",
											defaultValue: "Template User"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 707,
											columnNumber: 10
										}, this),
										/* @__PURE__ */ jsxDEV("input", {
											className: "demo-input",
											defaultValue: "@template-user"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 708,
											columnNumber: 10
										}, this)
									] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 705,
										columnNumber: 9
									}, this) : null,
									activeTab === "password" ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
										/* @__PURE__ */ jsxDEV("h3", { children: "Password Security" }, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 713,
											columnNumber: 10
										}, this),
										/* @__PURE__ */ jsxDEV("input", {
											className: "demo-input",
											type: "password"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 714,
											columnNumber: 10
										}, this),
										/* @__PURE__ */ jsxDEV("input", {
											className: "demo-input",
											type: "password"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 715,
											columnNumber: 10
										}, this)
									] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 712,
										columnNumber: 9
									}, this) : null,
									activeTab === "settings" ? /* @__PURE__ */ jsxDEV(Fragment, { children: [/* @__PURE__ */ jsxDEV("h3", { children: "Global Settings" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 720,
										columnNumber: 10
									}, this), /* @__PURE__ */ jsxDEV("label", {
										className: "switch-row split",
										children: [/* @__PURE__ */ jsxDEV("span", { children: "Public Profile" }, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 722,
											columnNumber: 11
										}, this), /* @__PURE__ */ jsxDEV("input", { type: "checkbox" }, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 723,
											columnNumber: 11
										}, this)]
									}, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 721,
										columnNumber: 10
									}, this)] }, void 0, true, {
										fileName: _jsxFileName$2,
										lineNumber: 719,
										columnNumber: 9
									}, this) : null
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 703,
								columnNumber: 7
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 673,
							columnNumber: 6
						}, this), /* @__PURE__ */ jsxDEV("div", {
							className: "disclosure-stack",
							children: [
								"tokens",
								"layout",
								"forms"
							].map((item) => /* @__PURE__ */ jsxDEV("div", {
								className: "accordion-item",
								children: [/* @__PURE__ */ jsxDEV("button", {
									type: "button",
									"aria-expanded": openAccordion === item,
									onClick: () => setOpenAccordion(openAccordion === item ? "" : item),
									children: [/* @__PURE__ */ jsxDEV("span", { children: getAccordionLabel(item) }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 740,
										columnNumber: 10
									}, this), /* @__PURE__ */ jsxDEV(ChevronDown, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 741,
										columnNumber: 10
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 733,
									columnNumber: 9
								}, this), openAccordion === item ? /* @__PURE__ */ jsxDEV("p", { children: getAccordionContent(item) }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 744,
									columnNumber: 10
								}, this) : null]
							}, item, true, {
								fileName: _jsxFileName$2,
								lineNumber: 732,
								columnNumber: 8
							}, this))
						}, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 730,
							columnNumber: 6
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 672,
						columnNumber: 5
					}, this),
					/* @__PURE__ */ jsxDEV("div", {
						className: "toolbar-row",
						children: [
							/* @__PURE__ */ jsxDEV("div", {
								className: "menu-wrap",
								children: [/* @__PURE__ */ jsxDEV("button", {
									type: "button",
									className: "demo-button variant-outline",
									"aria-expanded": menuOpen,
									onClick: () => setMenuOpen((value) => !value),
									children: ["Menu", /* @__PURE__ */ jsxDEV(ChevronDown, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 759,
										columnNumber: 8
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 752,
									columnNumber: 7
								}, this), menuOpen ? /* @__PURE__ */ jsxDEV("div", {
									className: "dropdown-panel",
									children: [
										/* @__PURE__ */ jsxDEV("button", {
											type: "button",
											children: "Edit"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 763,
											columnNumber: 9
										}, this),
										/* @__PURE__ */ jsxDEV("button", {
											type: "button",
											children: "Duplicate"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 764,
											columnNumber: 9
										}, this),
										/* @__PURE__ */ jsxDEV("button", {
											type: "button",
											children: "Archive"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 765,
											columnNumber: 9
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 762,
									columnNumber: 8
								}, this) : null]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 751,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("fieldset", {
								className: "view-switcher",
								children: [
									/* @__PURE__ */ jsxDEV("legend", {
										className: "sr-only",
										children: "View switcher"
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 770,
										columnNumber: 7
									}, this),
									/* @__PURE__ */ jsxDEV("button", {
										type: "button",
										className: activeView === "grid" ? "active" : "",
										"aria-pressed": activeView === "grid",
										onClick: () => setActiveView("grid"),
										children: /* @__PURE__ */ jsxDEV(Grid2X2, { className: "icon" }, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 777,
											columnNumber: 8
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 771,
										columnNumber: 7
									}, this),
									/* @__PURE__ */ jsxDEV("button", {
										type: "button",
										className: activeView === "list" ? "active" : "",
										"aria-pressed": activeView === "list",
										onClick: () => setActiveView("list"),
										children: /* @__PURE__ */ jsxDEV(List, { className: "icon" }, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 785,
											columnNumber: 8
										}, this)
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 779,
										columnNumber: 7
									}, this)
								]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 769,
								columnNumber: 6
							}, this),
							/* @__PURE__ */ jsxDEV("nav", {
								className: "pagination-row",
								"aria-label": "Pagination",
								children: [
									1,
									2,
									3,
									4
								].map((page) => /* @__PURE__ */ jsxDEV("button", {
									type: "button",
									className: activePage === page ? "active" : "",
									onClick: () => setActivePage(page),
									children: page
								}, page, false, {
									fileName: _jsxFileName$2,
									lineNumber: 790,
									columnNumber: 8
								}, this))
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 788,
								columnNumber: 6
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 750,
						columnNumber: 5
					}, this)
				]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 663,
				columnNumber: 4
			}, this),
			/* @__PURE__ */ jsxDEV("section", {
				className: "showcase-section",
				"aria-labelledby": "overlay-heading",
				children: [/* @__PURE__ */ jsxDEV("h2", {
					id: "overlay-heading",
					children: "Overlays & Panels"
				}, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 804,
					columnNumber: 5
				}, this), /* @__PURE__ */ jsxDEV("div", {
					className: "overlay-grid",
					children: [
						/* @__PURE__ */ jsxDEV("div", {
							className: "demo-card",
							children: [/* @__PURE__ */ jsxDEV("h3", { children: "Dialog" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 807,
								columnNumber: 7
							}, this), /* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button primary",
								onClick: () => setDialogOpen(true),
								children: "Open Dialog"
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 808,
								columnNumber: 7
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 806,
							columnNumber: 6
						}, this),
						/* @__PURE__ */ jsxDEV("div", {
							className: "demo-card",
							children: [/* @__PURE__ */ jsxDEV("h3", { children: "Popover" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 817,
								columnNumber: 7
							}, this), /* @__PURE__ */ jsxDEV("div", {
								className: "menu-wrap",
								children: [/* @__PURE__ */ jsxDEV("button", {
									type: "button",
									className: "demo-button variant-outline",
									"aria-expanded": popoverOpen,
									onClick: () => setPopoverOpen((value) => !value),
									children: [/* @__PURE__ */ jsxDEV(Info, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 825,
										columnNumber: 9
									}, this), "Status"]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 819,
									columnNumber: 8
								}, this), popoverOpen ? /* @__PURE__ */ jsxDEV("div", {
									className: "popover-panel",
									children: [/* @__PURE__ */ jsxDEV("strong", { children: "Healthy" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 830,
										columnNumber: 10
									}, this), /* @__PURE__ */ jsxDEV("span", { children: "All checks are passing." }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 831,
										columnNumber: 10
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 829,
									columnNumber: 9
								}, this) : null]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 818,
								columnNumber: 7
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 816,
							columnNumber: 6
						}, this),
						/* @__PURE__ */ jsxDEV("div", {
							className: "demo-card",
							children: [/* @__PURE__ */ jsxDEV("h3", { children: "Drawer" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 837,
								columnNumber: 7
							}, this), /* @__PURE__ */ jsxDEV("button", {
								type: "button",
								className: "demo-button secondary",
								onClick: () => setDrawerOpen(true),
								children: [/* @__PURE__ */ jsxDEV(PanelRight, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 843,
									columnNumber: 8
								}, this), "Open Panel"]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 838,
								columnNumber: 7
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 836,
							columnNumber: 6
						}, this),
						/* @__PURE__ */ jsxDEV("div", {
							className: "demo-card",
							children: [/* @__PURE__ */ jsxDEV("h3", { children: "Tooltip" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 848,
								columnNumber: 7
							}, this), /* @__PURE__ */ jsxDEV("div", {
								className: "tooltip-anchor",
								children: [/* @__PURE__ */ jsxDEV("button", {
									type: "button",
									className: "demo-icon-button",
									children: /* @__PURE__ */ jsxDEV(CreditCard, { className: "icon" }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 851,
										columnNumber: 9
									}, this)
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 850,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("span", {
									className: "tooltip-bubble",
									children: "Billing settings"
								}, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 853,
									columnNumber: 8
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 849,
								columnNumber: 7
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 847,
							columnNumber: 6
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 805,
					columnNumber: 5
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 803,
				columnNumber: 4
			}, this),
			/* @__PURE__ */ jsxDEV("section", {
				className: "showcase-section",
				"aria-labelledby": "table-heading",
				children: [/* @__PURE__ */ jsxDEV("h2", {
					id: "table-heading",
					children: "Data Display"
				}, void 0, false, {
					fileName: _jsxFileName$2,
					lineNumber: 860,
					columnNumber: 5
				}, this), /* @__PURE__ */ jsxDEV("div", {
					className: "data-layout-grid",
					children: [/* @__PURE__ */ jsxDEV("div", {
						className: "table-demo",
						children: [
							/* @__PURE__ */ jsxDEV("div", {
								className: "table-toolbar",
								children: [/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("strong", { children: "Component Inventory" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 865,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("span", { children: [table.getPrePaginationRowModel().rows.length, " components"] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 866,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 864,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("label", {
									htmlFor: "showcase-page-size",
									children: ["Rows", /* @__PURE__ */ jsxDEV("select", {
										id: "showcase-page-size",
										value: search.pageSize,
										onChange: (event) => {
											table.setPageSize(Number(event.target.value));
											updateTableSearch({
												page: 1,
												pageSize: Number(event.target.value)
											});
										},
										children: showcaseTablePageSizes.map((pageSize) => /* @__PURE__ */ jsxDEV("option", {
											value: pageSize,
											children: pageSize
										}, pageSize, false, {
											fileName: _jsxFileName$2,
											lineNumber: 884,
											columnNumber: 11
										}, this))
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 872,
										columnNumber: 9
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 870,
									columnNumber: 8
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 863,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "table-panel",
								children: /* @__PURE__ */ jsxDEV("table", { children: [/* @__PURE__ */ jsxDEV("thead", { children: table.getHeaderGroups().map((headerGroup) => /* @__PURE__ */ jsxDEV("tr", { children: headerGroup.headers.map((header) => /* @__PURE__ */ jsxDEV("th", { children: header.isPlaceholder ? null : /* @__PURE__ */ jsxDEV("button", {
									type: "button",
									className: "table-sort-button",
									onClick: header.column.getToggleSortingHandler(),
									"aria-label": `Sort by ${String(header.column.columnDef.header)}`,
									children: [/* @__PURE__ */ jsxDEV("span", { children: flexRender(header.column.columnDef.header, header.getContext()) }, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 907,
										columnNumber: 16
									}, this), /* @__PURE__ */ jsxDEV("span", {
										className: "table-sort-icon",
										"aria-hidden": "true",
										children: getSortIndicator(header.column.getIsSorted())
									}, void 0, false, {
										fileName: _jsxFileName$2,
										lineNumber: 913,
										columnNumber: 16
									}, this)]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 899,
									columnNumber: 15
								}, this) }, header.id, false, {
									fileName: _jsxFileName$2,
									lineNumber: 897,
									columnNumber: 13
								}, this)) }, headerGroup.id, false, {
									fileName: _jsxFileName$2,
									lineNumber: 895,
									columnNumber: 11
								}, this)) }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 893,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("tbody", { children: table.getRowModel().rows.map((row) => /* @__PURE__ */ jsxDEV("tr", { children: row.getVisibleCells().map((cell) => /* @__PURE__ */ jsxDEV("td", { children: flexRender(cell.column.columnDef.cell, cell.getContext()) }, cell.id, false, {
									fileName: _jsxFileName$2,
									lineNumber: 930,
									columnNumber: 13
								}, this)) }, row.id, false, {
									fileName: _jsxFileName$2,
									lineNumber: 928,
									columnNumber: 11
								}, this)) }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 926,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 892,
									columnNumber: 8
								}, this)
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 891,
								columnNumber: 7
							}, this),
							/* @__PURE__ */ jsxDEV("div", {
								className: "table-pagination-bar",
								children: [/* @__PURE__ */ jsxDEV("div", {
									className: "table-page-summary",
									children: [
										"Page ",
										table.getState().pagination.pageIndex + 1,
										" of",
										" ",
										table.getPageCount()
									]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 943,
									columnNumber: 8
								}, this), /* @__PURE__ */ jsxDEV("nav", {
									className: "table-pagination",
									"aria-label": "Table pagination",
									children: [
										/* @__PURE__ */ jsxDEV("button", {
											type: "button",
											onClick: () => {
												table.previousPage();
												updateTableSearch({ page: search.page - 1 });
											},
											disabled: !table.getCanPreviousPage(),
											children: "Previous"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 948,
											columnNumber: 9
										}, this),
										visiblePageNumbers.map((pageNumber) => /* @__PURE__ */ jsxDEV("button", {
											type: "button",
											className: search.page === pageNumber ? "active" : "",
											"aria-current": search.page === pageNumber ? "page" : void 0,
											onClick: () => {
												table.setPageIndex(pageNumber - 1);
												updateTableSearch({ page: pageNumber });
											},
											children: pageNumber
										}, pageNumber, false, {
											fileName: _jsxFileName$2,
											lineNumber: 961,
											columnNumber: 10
										}, this)),
										/* @__PURE__ */ jsxDEV("button", {
											type: "button",
											onClick: () => {
												table.nextPage();
												updateTableSearch({ page: search.page + 1 });
											},
											disabled: !table.getCanNextPage(),
											children: "Next"
										}, void 0, false, {
											fileName: _jsxFileName$2,
											lineNumber: 978,
											columnNumber: 9
										}, this)
									]
								}, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 947,
									columnNumber: 8
								}, this)]
							}, void 0, true, {
								fileName: _jsxFileName$2,
								lineNumber: 942,
								columnNumber: 7
							}, this)
						]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 862,
						columnNumber: 6
					}, this), /* @__PURE__ */ jsxDEV("div", {
						className: "side-data",
						children: [/* @__PURE__ */ jsxDEV("div", {
							className: "mini-table",
							children: [
								/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "Health" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 996,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("strong", { children: "99%" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 997,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 995,
									columnNumber: 8
								}, this),
								/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "Latency" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1e3,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("strong", { children: "42ms" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1001,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 999,
									columnNumber: 8
								}, this),
								/* @__PURE__ */ jsxDEV("div", { children: [/* @__PURE__ */ jsxDEV("span", { children: "Errors" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1004,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("strong", { children: "0" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1005,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 1003,
									columnNumber: 8
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 994,
							columnNumber: 7
						}, this), /* @__PURE__ */ jsxDEV("ul", {
							className: "file-tree",
							children: [
								/* @__PURE__ */ jsxDEV("li", { children: [/* @__PURE__ */ jsxDEV(Folder, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1010,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("span", { children: "src" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1011,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 1009,
									columnNumber: 8
								}, this),
								/* @__PURE__ */ jsxDEV("li", { children: [/* @__PURE__ */ jsxDEV(FileText, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1014,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("span", { children: "routes/showcase-route.tsx" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1015,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 1013,
									columnNumber: 8
								}, this),
								/* @__PURE__ */ jsxDEV("li", { children: [/* @__PURE__ */ jsxDEV(FileText, { className: "icon" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1018,
									columnNumber: 9
								}, this), /* @__PURE__ */ jsxDEV("span", { children: "views/showcase-view.tsx" }, void 0, false, {
									fileName: _jsxFileName$2,
									lineNumber: 1019,
									columnNumber: 9
								}, this)] }, void 0, true, {
									fileName: _jsxFileName$2,
									lineNumber: 1017,
									columnNumber: 8
								}, this)
							]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 1008,
							columnNumber: 7
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 993,
						columnNumber: 6
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 861,
					columnNumber: 5
				}, this)]
			}, void 0, true, {
				fileName: _jsxFileName$2,
				lineNumber: 859,
				columnNumber: 4
			}, this),
			dialogOpen ? /* @__PURE__ */ jsxDEV("div", {
				className: "modal-backdrop",
				role: "presentation",
				children: /* @__PURE__ */ jsxDEV("div", {
					className: "modal-panel",
					role: "dialog",
					"aria-modal": "true",
					children: [
						/* @__PURE__ */ jsxDEV("header", { children: [/* @__PURE__ */ jsxDEV("h3", { children: "Confirm deployment" }, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 1030,
							columnNumber: 8
						}, this), /* @__PURE__ */ jsxDEV("button", {
							type: "button",
							className: "demo-icon-button",
							"aria-label": "Close dialog",
							onClick: () => setDialogOpen(false),
							children: /* @__PURE__ */ jsxDEV(X, { className: "icon" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 1037,
								columnNumber: 9
							}, this)
						}, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 1031,
							columnNumber: 8
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 1029,
							columnNumber: 7
						}, this),
						/* @__PURE__ */ jsxDEV("p", { children: "Deploy the current template snapshot." }, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 1040,
							columnNumber: 7
						}, this),
						/* @__PURE__ */ jsxDEV("footer", { children: [/* @__PURE__ */ jsxDEV("button", {
							type: "button",
							className: "demo-button variant-outline",
							onClick: () => setDialogOpen(false),
							children: "Cancel"
						}, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 1042,
							columnNumber: 8
						}, this), /* @__PURE__ */ jsxDEV("button", {
							type: "button",
							className: "demo-button primary",
							onClick: () => setDialogOpen(false),
							children: "Deploy"
						}, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 1049,
							columnNumber: 8
						}, this)] }, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 1041,
							columnNumber: 7
						}, this)
					]
				}, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 1028,
					columnNumber: 6
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName$2,
				lineNumber: 1027,
				columnNumber: 5
			}, this) : null,
			drawerOpen ? /* @__PURE__ */ jsxDEV("div", {
				className: "drawer-backdrop",
				role: "presentation",
				children: /* @__PURE__ */ jsxDEV("aside", {
					className: "drawer-panel",
					"aria-label": "Settings panel",
					children: [/* @__PURE__ */ jsxDEV("header", { children: [/* @__PURE__ */ jsxDEV("h3", { children: "Panel" }, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 1065,
						columnNumber: 8
					}, this), /* @__PURE__ */ jsxDEV("button", {
						type: "button",
						className: "demo-icon-button",
						"aria-label": "Close panel",
						onClick: () => setDrawerOpen(false),
						children: /* @__PURE__ */ jsxDEV(X, { className: "icon" }, void 0, false, {
							fileName: _jsxFileName$2,
							lineNumber: 1072,
							columnNumber: 9
						}, this)
					}, void 0, false, {
						fileName: _jsxFileName$2,
						lineNumber: 1066,
						columnNumber: 8
					}, this)] }, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 1064,
						columnNumber: 7
					}, this), /* @__PURE__ */ jsxDEV("div", {
						className: "switch-column",
						children: [/* @__PURE__ */ jsxDEV("label", {
							className: "switch-row split",
							children: [/* @__PURE__ */ jsxDEV("span", { children: "Audit log" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 1077,
								columnNumber: 9
							}, this), /* @__PURE__ */ jsxDEV("input", {
								type: "checkbox",
								defaultChecked: true
							}, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 1078,
								columnNumber: 9
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 1076,
							columnNumber: 8
						}, this), /* @__PURE__ */ jsxDEV("label", {
							className: "switch-row split",
							children: [/* @__PURE__ */ jsxDEV("span", { children: "Compact mode" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 1081,
								columnNumber: 9
							}, this), /* @__PURE__ */ jsxDEV("input", { type: "checkbox" }, void 0, false, {
								fileName: _jsxFileName$2,
								lineNumber: 1082,
								columnNumber: 9
							}, this)]
						}, void 0, true, {
							fileName: _jsxFileName$2,
							lineNumber: 1080,
							columnNumber: 8
						}, this)]
					}, void 0, true, {
						fileName: _jsxFileName$2,
						lineNumber: 1075,
						columnNumber: 7
					}, this)]
				}, void 0, true, {
					fileName: _jsxFileName$2,
					lineNumber: 1063,
					columnNumber: 6
				}, this)
			}, void 0, false, {
				fileName: _jsxFileName$2,
				lineNumber: 1062,
				columnNumber: 5
			}, this) : null
		]
	}, void 0, true, {
		fileName: _jsxFileName$2,
		lineNumber: 224,
		columnNumber: 3
	}, this);
}
function getComponentCategory(component) {
	if ([
		"Button",
		"IconButton",
		"Badge",
		"Alert",
		"NotificationToast",
		"Progress",
		"Skeleton",
		"Spinner"
	].includes(component)) return "Actions & Feedback";
	if ([
		"Input",
		"InputGroup",
		"InputOtp",
		"Textarea",
		"Select",
		"Combobox",
		"Checkbox",
		"RadioGroup",
		"Switch"
	].includes(component)) return "Forms";
	if ([
		"Tabs",
		"Breadcrumb",
		"Accordion",
		"DropdownMenu",
		"Pagination",
		"ViewSwitcher"
	].includes(component)) return "Navigation";
	if ([
		"Dialog",
		"Drawer",
		"Popover",
		"Tooltip"
	].includes(component)) return "Overlays";
	if ([
		"Table",
		"MiniTable",
		"List",
		"FileTree"
	].includes(component)) return "Data Display";
	return "Content";
}
function getComponentStatus(component) {
	const category = getComponentCategory(component);
	if (category === "Navigation" || category === "Overlays") return "Interactive";
	if (category === "Actions & Feedback" || category === "Forms") return "Ready";
	return "Documented";
}
function getSortIndicator(sortState) {
	if (sortState === "asc") return /* @__PURE__ */ jsxDEV(ArrowUp, { className: "icon" }, void 0, false, {
		fileName: _jsxFileName$2,
		lineNumber: 1156,
		columnNumber: 10
	}, this);
	if (sortState === "desc") return /* @__PURE__ */ jsxDEV(ArrowDown, { className: "icon" }, void 0, false, {
		fileName: _jsxFileName$2,
		lineNumber: 1159,
		columnNumber: 10
	}, this);
	return /* @__PURE__ */ jsxDEV(ArrowUpDown, { className: "icon" }, void 0, false, {
		fileName: _jsxFileName$2,
		lineNumber: 1161,
		columnNumber: 9
	}, this);
}
function getVisiblePageNumbers(pageCount, currentPage) {
	const safePageCount = Math.max(pageCount, 1);
	const startPage = Math.max(1, Math.min(Math.max(currentPage, 1), safePageCount) - 1);
	const endPage = Math.min(safePageCount, startPage + 2);
	const adjustedStartPage = Math.max(1, endPage - 2);
	return Array.from({ length: endPage - adjustedStartPage + 1 }, (_, index) => adjustedStartPage + index);
}
function getAccordionLabel(item) {
	if (item === "tokens") return "Design Tokens";
	if (item === "layout") return "Layout";
	return "Forms";
}
function getAccordionContent(item) {
	if (item === "tokens") return "Color, radius, spacing, and typography primitives.";
	if (item === "layout") return "Cards, panels, sections, and dense application surfaces.";
	return "Fields, selection controls, and validation states.";
}
//#endregion
//#region web/src/routes/showcase-route.tsx
var showcaseRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/showcase",
	validateSearch: parseShowcaseTableSearch,
	component: ShowcaseView
});
//#endregion
//#region web/src/router.tsx
var routeTree = rootRoute.addChildren([
	homeRoute,
	showcaseRoute,
	loginRoute,
	protectedRoute
]);
function createAppRouter(history) {
	return createRouter({
		routeTree,
		history
	});
}
var router = createAppRouter();
//#endregion
//#region web/src/App.tsx
var _jsxFileName$1 = "/Users/y.noguchi/Code/hono-standard/web/src/App.tsx";
var queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function App({ router: router$1 = router }) {
	return /* @__PURE__ */ jsxDEV(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ jsxDEV(ShowcaseSettingsProvider, { children: /* @__PURE__ */ jsxDEV(RouterProvider, { router: router$1 }, void 0, false, {
			fileName: _jsxFileName$1,
			lineNumber: 22,
			columnNumber: 5
		}, this) }, void 0, false, {
			fileName: _jsxFileName$1,
			lineNumber: 21,
			columnNumber: 4
		}, this)
	}, void 0, false, {
		fileName: _jsxFileName$1,
		lineNumber: 20,
		columnNumber: 3
	}, this);
}
//#endregion
//#region web/src/entry-server.tsx
var _jsxFileName = "/Users/y.noguchi/Code/hono-standard/web/src/entry-server.tsx";
async function render(url) {
	const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }));
	await router.load();
	return { html: ReactDOMServer.renderToString(/* @__PURE__ */ jsxDEV(App, { router }, void 0, false, {
		fileName: _jsxFileName,
		lineNumber: 15,
		columnNumber: 39
	}, this)) };
}
//#endregion
export { render };
