import {
	createLazyRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../auth-context";
import {
	resolveDashboardSearch,
	timezoneOptions,
} from "../../../routes/dashboard-route-search";
import { DashboardInspector } from "./inspector/inspector";
import { DashboardGridV2 } from "./layout/dashboard-grid";
import {
	moveDashboardLayout,
	restoreLayouts,
	writeStoredLayouts,
} from "./layout/layout";
import { useDashboardLayoutState } from "./layout/layout-state";
import { resolveDashboardLinkV2 } from "./links/resolve-link";
import { PanelShell } from "./panel/panel-shell";
import {
	useDashboardManifestV2,
	useDashboardPanelsV2,
	useDashboardVariablesV2,
} from "./query-options";
import { createDashboardFrontendRuntime } from "./runtime/dashboard-runtime";
import { reconcileVariableFilters } from "./variables";
import { coreVisualizationCatalog } from "./visualizations/catalog";

const runtime = createDashboardFrontendRuntime({
	visualizations: coreVisualizationCatalog,
});

const toDateTimeLocal = (value: Date | string) => {
	const date = value instanceof Date ? value : new Date(value);
	if (!Number.isFinite(date.getTime())) return "";
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
};

function DashboardToolbar({
	manifest,
	search,
	filters,
	optionResults,
	onSearch,
	edit,
	onEdit,
	onSave,
	onCancel,
	onReset,
	onRefresh,
	dirty,
	variableStatuses,
}: {
	manifest: {
		title: string;
		description: string;
		variables: Array<{
			id: string;
			label: string;
			selection: "single" | "multiple";
			defaultValues: string[];
		}>;
	};
	search: ReturnType<typeof resolveDashboardSearch>["canonicalRouteSearch"];
	filters: Record<string, string[]>;
	optionResults: Array<{
		isPending?: boolean;
		isError?: boolean;
		error?: Error | null;
		refetch?: () => unknown;
		data?: {
			options: Array<{ value: string; label: string; disabled?: boolean }>;
		};
	}>;
	onSearch: (next: Record<string, unknown>) => void;
	edit: boolean;
	onEdit: () => void;
	onSave: () => void;
	onCancel: () => void;
	onReset: () => void;
	onRefresh: () => void;
	dirty: boolean;
	variableStatuses: Record<string, "blocked" | "loading" | "error" | "ready">;
}) {
	const now = new Date();
	const [customOpen, setCustomOpen] = useState(search.range === "custom");
	const [customDraft, setCustomDraft] = useState(() => ({
		from:
			(search.from && toDateTimeLocal(search.from)) ||
			toDateTimeLocal(new Date(now.getTime() - 60 * 60_000)),
		to: (search.to && toDateTimeLocal(search.to)) || toDateTimeLocal(now),
	}));
	useEffect(() => {
		if (search.range !== "custom" || !search.from || !search.to) return;
		setCustomDraft({
			from: toDateTimeLocal(search.from),
			to: toDateTimeLocal(search.to),
		});
	}, [search.range, search.from, search.to]);
	const customValid =
		Number.isFinite(Date.parse(customDraft.from)) &&
		Number.isFinite(Date.parse(customDraft.to)) &&
		Date.parse(customDraft.from) < Date.parse(customDraft.to);
	const timezones = useMemo(
		() => timezoneOptions(search.timezone),
		[search.timezone],
	);
	const standardRefresh = [0, 10, 30, 60];
	return (
		<section className="dashboard-toolbar" aria-label="Dashboard controls">
			<div className="dashboard-toolbar-row">
				<div className="dashboard-title-block">
					<div className="dashboard-kicker">
						<span className="dashboard-live-dot" />
						Operations dashboard
					</div>
					<h1>{manifest.title}</h1>
					<p>{manifest.description}</p>
				</div>
				<div className="dashboard-toolbar-actions">
					<Link to="/dashboard/gallery">Visualization gallery</Link>
					<button type="button" onClick={onRefresh}>
						Refresh data
					</button>
					{edit ? (
						<>
							<span className="dashboard-edit-badge">Editing layout</span>
							<button
								type="button"
								className="is-primary"
								onClick={onSave}
								disabled={!dirty}
							>
								Save
							</button>
							<button type="button" onClick={onCancel}>
								Cancel
							</button>
							<button type="button" onClick={onReset}>
								Reset
							</button>
						</>
					) : (
						<button type="button" className="is-primary" onClick={onEdit}>
							Edit layout
						</button>
					)}
				</div>
			</div>
			<div className="dashboard-filter-bar">
				<div className="dashboard-filters">
					<label className="dashboard-filter-field">
						<span>Range</span>
						<select
							value={customOpen ? "custom" : (search.range ?? "6h")}
							onChange={(event) => {
								if (event.target.value === "custom") {
									setCustomOpen(true);
									return;
								}
								setCustomOpen(false);
								onSearch({
									range: event.target.value,
									from: undefined,
									to: undefined,
								});
							}}
						>
							<option value="15m">15 minutes</option>
							<option value="1h">1 hour</option>
							<option value="6h">6 hours</option>
							<option value="24h">24 hours</option>
							<option value="7d">7 days</option>
							<option value="custom">Custom</option>
						</select>
					</label>
					<label className="dashboard-filter-field">
						<span>Refresh</span>
						<select
							value={String(search.refresh ?? 0)}
							onChange={(event) =>
								onSearch({ refresh: Number(event.target.value) })
							}
						>
							{!standardRefresh.includes(search.refresh ?? 0) ? (
								<option value={String(search.refresh)}>
									{search.refresh} seconds
								</option>
							) : null}
							<option value="0">Off</option>
							<option value="10">10 seconds</option>
							<option value="30">30 seconds</option>
							<option value="60">1 minute</option>
						</select>
					</label>
					<label className="dashboard-filter-field">
						<span>Timezone</span>
						<input
							list="dashboard-timezones"
							value={search.timezone ?? "UTC"}
							onChange={(event) => onSearch({ timezone: event.target.value })}
						/>
						<datalist id="dashboard-timezones">
							{timezones.map((timezone) => (
								<option key={timezone} value={timezone} />
							))}
						</datalist>
					</label>
					{manifest.variables.map((variable, index) => {
						const options =
							optionResults[index]?.data?.options ??
							variable.defaultValues.map((value) => ({
								value,
								label: value,
								disabled: false,
							}));
						const selected = filters[variable.id] ?? [];
						const status = variableStatuses[variable.id] ?? "loading";
						return (
							<fieldset
								key={variable.id}
								aria-label={variable.label}
								disabled={status === "blocked" || status === "loading"}
							>
								<label className="dashboard-filter-field">
									<span>{variable.label}</span>
									<select
										multiple={variable.selection === "multiple"}
										value={
											variable.selection === "multiple"
												? selected
												: (selected[0] ?? "")
										}
										onChange={(event) => {
											const values =
												variable.selection === "multiple"
													? [...event.currentTarget.selectedOptions].map(
															(option) => option.value,
														)
													: event.currentTarget.value
														? [event.currentTarget.value]
														: [];
											onSearch({
												filters: { ...filters, [variable.id]: values },
											});
										}}
									>
										{variable.selection !== "multiple" ? (
											<option value="">
												{variableStatuses[variable.id] === "ready"
													? "No filter"
													: "Loading…"}
											</option>
										) : null}
										{options.map((option) => (
											<option
												key={option.value}
												value={option.value}
												disabled={option.disabled}
											>
												{option.label}
											</option>
										))}
									</select>
								</label>
								{status === "blocked" ? (
									<p className="dashboard-filter-muted">
										Choose its dependency first.
									</p>
								) : status === "error" ? (
									<p className="dashboard-variable-error" role="alert">
										{optionResults[index]?.error?.message ??
											"Options are unavailable."}{" "}
										<button
											type="button"
											onClick={() => void optionResults[index]?.refetch?.()}
										>
											Retry
										</button>
									</p>
								) : null}
							</fieldset>
						);
					})}
				</div>
				{customOpen ? (
					<fieldset
						className="dashboard-custom-range"
						aria-label="Custom range"
					>
						<label className="dashboard-filter-field">
							<span>From</span>
							<input
								type="datetime-local"
								value={customDraft.from}
								onChange={(event) =>
									setCustomDraft((current) => ({
										...current,
										from: event.target.value,
									}))
								}
							/>
						</label>
						<label className="dashboard-filter-field">
							<span>To</span>
							<input
								type="datetime-local"
								value={customDraft.to}
								onChange={(event) =>
									setCustomDraft((current) => ({
										...current,
										to: event.target.value,
									}))
								}
							/>
						</label>
						<button
							type="button"
							disabled={!customValid}
							onClick={() => {
								onSearch({
									range: "custom",
									from: new Date(customDraft.from).toISOString(),
									to: new Date(customDraft.to).toISOString(),
								});
								setCustomOpen(false);
							}}
						>
							Apply range
						</button>
					</fieldset>
				) : null}
			</div>
		</section>
	);
}
function AuthenticatedDashboardPageV2() {
	const id = "operations";
	const search = useSearch({ from: "/dashboard" });
	const navigate = useNavigate({ from: "/dashboard" });
	const manifestQuery = useDashboardManifestV2(id);
	const manifest = manifestQuery.data;
	const resolved = manifest
		? resolveDashboardSearch({ routeSearch: search, manifest })
		: undefined;
	const variables = useDashboardVariablesV2(
		id,
		manifest,
		resolved?.value.range ?? { kind: "relative", value: "1h" },
		resolved?.value.timezone ?? "UTC",
		resolved?.value.filters ?? {},
	);
	const reconciled =
		manifest && resolved
			? reconcileVariableFilters(manifest, variables, resolved.value.filters)
			: undefined;
	useEffect(() => {
		if (resolved?.needsReplace)
			void navigate({
				search: resolved.canonicalRouteSearch,
				replace: true,
				resetScroll: false,
			});
		else if (reconciled?.changed)
			void navigate({
				search: (previous) => ({ ...previous, filters: reconciled.filters }),
				replace: true,
				resetScroll: false,
			});
	}, [resolved, reconciled, navigate]);
	const request = resolved
		? {
				schemaVersion: 2 as const,
				range: resolved.value.range,
				timezone: resolved.value.timezone,
				filters: reconciled?.filters ?? resolved.value.filters,
				maxDataPoints: 800,
				maxRows: 2000,
			}
		: {
				schemaVersion: 2 as const,
				range: { kind: "relative" as const, value: "1h" as const },
				timezone: "UTC",
				filters: {},
				maxDataPoints: 800,
				maxRows: 2000,
			};
	const panelQueries = useDashboardPanelsV2(
		id,
		manifest,
		request,
		resolved?.value.refresh ?? 0,
		!!manifest && !!reconciled?.panelsReady && !reconciled.changed,
	);
	const initialLayouts = useMemo(
		() =>
			manifest
				? restoreLayouts(
						manifest,
						(type) => runtime.visualizations.get(type)?.descriptor.minimumSize,
					)
				: { lg: [], md: [], sm: [], xs: [] },
		[manifest],
	);
	const layout = useDashboardLayoutState(initialLayouts);
	const [inspector, setInspector] = useState<string | null>(null);
	if (manifestQuery.isPending)
		return (
			<main className="dashboard-page">
				<div className="dashboard-loading">Loading dashboard…</div>
			</main>
		);
	if (manifestQuery.isError || !manifest || !resolved)
		return (
			<main className="dashboard-page">
				<div
					className="dashboard-panel-state dashboard-panel-error"
					role="alert"
				>
					<p>{manifestQuery.error?.message ?? "Dashboard unavailable"}</p>
					<button type="button" onClick={() => void manifestQuery.refetch()}>
						Retry
					</button>
				</div>
			</main>
		);
	const save = () => {
		if (writeStoredLayouts(id, manifest.layoutVersion, layout.draft))
			layout.save();
	};
	const inspectedIndex = inspector
		? manifest.panels.findIndex((panel) => panel.id === inspector)
		: -1;
	const inspectedPanel =
		inspectedIndex >= 0 ? manifest.panels[inspectedIndex] : undefined;
	return (
		<main className="dashboard-page" data-dashboard-ready="true">
			<DashboardToolbar
				manifest={manifest}
				search={resolved.canonicalRouteSearch}
				filters={reconciled?.filters ?? resolved.value.filters}
				optionResults={variables}
				onSearch={(next) =>
					void navigate({
						search: (previous) => ({ ...previous, ...next }),
						replace: true,
						resetScroll: false,
					})
				}
				edit={layout.mode !== "view"}
				onEdit={layout.enterEdit}
				onSave={save}
				onCancel={layout.cancel}
				onReset={layout.reset}
				dirty={layout.mode === "edit-dirty"}
				variableStatuses={reconciled?.statusByVariable ?? {}}
				onRefresh={() => {
					for (const panelQuery of panelQueries)
						void panelQuery.refetch({ cancelRefetch: true });
				}}
			/>
			<DashboardGridV2
				layouts={layout.draft}
				editMode={layout.mode !== "view"}
				onChange={layout.update}
			>
				{manifest.panels.map((panel, index) => {
					const panelQuery = panelQueries[index];
					if (!panelQuery) return null;
					const headerLinks = panel.links.flatMap((link) => {
						const resolvedLink = resolveDashboardLinkV2(
							link,
							request.filters,
							request.range,
							{},
						);
						return resolvedLink
							? [
									<Link
										key={link.id}
										to={resolvedLink.to}
										search={resolvedLink.search}
										target={resolvedLink.openInNewTab ? "_blank" : undefined}
									>
										{link.title}
									</Link>,
								]
							: [];
					});
					return (
						<div key={panel.id} className="dashboard-grid-item">
							<PanelShell
								dashboardId={id}
								panel={panel}
								query={panelQuery}
								visualizations={runtime.visualizations}
								transformations={runtime.transformations}
								timezone={resolved.value.timezone}
								onInspect={() => setInspector(panel.id)}
								headerLinks={headerLinks.length ? headerLinks : undefined}
								editMode={layout.mode !== "view"}
								onMove={(direction) =>
									layout.update(
										moveDashboardLayout(layout.draft, panel.id, direction),
									)
								}
							/>
						</div>
					);
				})}
			</DashboardGridV2>
			{(import.meta.env.DEV || import.meta.env.VITE_E2E_INSPECTOR === "true") &&
			manifest.inspectorEnabled &&
			inspector &&
			inspectedPanel ? (
				<DashboardInspector
					panel={inspectedPanel}
					response={panelQueries[inspectedIndex]?.data}
					request={request}
					error={panelQueries[inspectedIndex]?.error}
					onClose={() => setInspector(null)}
				/>
			) : null}
		</main>
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
	return <AuthenticatedDashboardPageV2 />;
}
export const dashboardV2LazyRoute = createLazyRoute("/dashboard")({
	component: DashboardPageV2,
});
