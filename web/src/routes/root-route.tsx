import {
	createRootRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	Database,
	FileText,
	Home,
	LayoutGrid,
	LogOut,
	Shield,
} from "lucide-react";
import { AuthProvider, useAuth } from "../auth-context";
import { DevErrorPanel } from "../components/dev-error-panel";
import {
	PageEditGuardProvider,
	PageLeaveDialog,
	usePageEditGuard,
	usePublishPageAutosaveHold,
} from "../page-edit-guard";
import { defaultShowcaseTableSearch } from "../showcase-table-search";
import { requiresSessionCheck } from "./route-access";

function AppLayout() {
	const { authUser, busy, errorText, logoutCurrentUser } = useAuth();
	const { unsaved, saving } = usePageEditGuard();
	const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
	usePublishPageAutosaveHold(Boolean(authUser) && logoutConfirmOpen);

	useEffect(() => {
		if (!authUser) setLogoutConfirmOpen(false);
	}, [authUser]);

	const requestLogout = () => {
		if (saving) return;
		if (unsaved) {
			setLogoutConfirmOpen(true);
			return;
		}
		void logoutCurrentUser();
	};

	return (
		<div className="app-root min-h-screen">
			<header className="topbar">
				<Link to="/" className="brand">
					<Database className="icon" />
					<span>hono-standard</span>
				</Link>
				<div className="topbar-actions">
					<nav className="menu-nav" aria-label="Primary">
						<Link
							to="/"
							className="menu-link"
							activeProps={{ className: "menu-link active" }}
						>
							<Home className="icon" />
							Home
						</Link>
						<Link
							to="/showcase"
							search={defaultShowcaseTableSearch}
							className="menu-link"
							activeProps={{ className: "menu-link active" }}
						>
							<LayoutGrid className="icon" />
							Showcase
						</Link>
						{authUser ? (
							<Link
								to="/pages"
								className="menu-link"
								activeOptions={{ exact: false }}
								activeProps={{ className: "menu-link active" }}
							>
								<FileText className="icon" />
								Pages
							</Link>
						) : null}
						<Link
							to="/login"
							className="menu-link"
							activeProps={{ className: "menu-link active" }}
						>
							Login
						</Link>
					</nav>
					{authUser ? (
						<>
							<div className="auth-chip">
								<Shield className="icon" />
								<span>
									{authUser.displayName} ({authUser.role})
								</span>
							</div>
							<button
								type="button"
								className="icon-button"
								onClick={requestLogout}
								disabled={busy || saving}
								aria-label="Logout"
								title="Logout"
							>
								<LogOut className="icon" />
							</button>
						</>
					) : null}
				</div>
			</header>

			{errorText ? <div className="status error">{errorText}</div> : null}

			<Outlet />
			{logoutConfirmOpen ? (
				<PageLeaveDialog
					confirmDisabled={saving || busy}
					confirmLabel="破棄してログアウト"
					message={saving ? "保存が終わるまでログアウトできません" : null}
					onCancel={() => setLogoutConfirmOpen(false)}
					onConfirm={() => {
						if (saving) return;
						void logoutCurrentUser();
					}}
					title="未保存の変更を破棄してログアウトしますか"
					titleId="logout-leave-title"
				/>
			) : null}
		</div>
	);
}

function AppShell() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<AuthProvider sessionCheckEnabled={requiresSessionCheck(pathname)}>
			<PageEditGuardProvider>
				<AppLayout />
			</PageEditGuardProvider>
		</AuthProvider>
	);
}

export const rootRoute = createRootRoute({
	component: AppShell,
	errorComponent: DevErrorPanel,
});
