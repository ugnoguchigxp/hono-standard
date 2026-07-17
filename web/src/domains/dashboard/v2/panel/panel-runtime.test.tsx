// @vitest-environment jsdom

import type { PanelQueryResponseV2 } from "@shared/schemas/dashboard.schema";
import {
	QueryClient,
	QueryClientProvider,
	type UseQueryResult,
} from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FrontendTransformationRegistry } from "../runtime/transformation-registry";
import { FrontendVisualizationRegistry } from "../runtime/visualization-registry";
import { tableFrame, tablePanel } from "../test/fixtures";
import { coreTableDefinition } from "../visualizations/core-table/definition";
import { PanelNotices } from "./panel-notices";
import { PanelRenderErrorBoundary } from "./panel-render-error-boundary";
import { PanelShell } from "./panel-shell";
import "../test/setup";

const response = (): PanelQueryResponseV2 => ({
	schemaVersion: 2,
	requestId: "11111111-1111-4111-8111-111111111111",
	generatedAt: "2026-07-16T00:00:00.000Z",
	resolvedRange: {
		from: "2026-07-16T00:00:00.000Z",
		to: "2026-07-16T01:00:00.000Z",
	},
	durationMs: 1,
	counts: { frames: 1, fields: 2, rows: 1, cells: 2 },
	state: {
		partial: true,
		truncated: false,
		dataThrough: "2020-01-01T00:00:00.000Z",
		staleAfterMs: 1,
		notices: [{ code: "NOTICE", message: "A notice", severity: "warning" }],
	},
	frames: [tableFrame([{ name: "api", value: 1 }])],
});

const queryFor = (
	overrides: Partial<UseQueryResult<PanelQueryResponseV2, Error>> = {},
) =>
	({
		data: response(),
		isPending: false,
		isStale: true,
		error: null,
		refetch: vi.fn(),
		...overrides,
	}) as unknown as UseQueryResult<PanelQueryResponseV2, Error>;

const renderWithClient = (node: React.ReactNode) =>
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			{node}
		</QueryClientProvider>,
	);

describe("Panel runtime components", () => {
	it("isolates panel states and shares frames with renderer/table", async () => {
		const user = userEvent.setup();
		const panel = tablePanel();
		const move = vi.fn();
		const inspect = vi.fn();
		const registry = new FrontendVisualizationRegistry([
			{
				...coreTableDefinition,
				load: async () => ({
					Renderer: () => <div>renderer output</div>,
					buildAccessibleSummary: () => "summary",
				}),
			},
		]);
		renderWithClient(
			<PanelShell
				dashboardId="dashboard"
				panel={panel}
				query={queryFor()}
				visualizations={registry}
				transformations={new FrontendTransformationRegistry([])}
				timezone="UTC"
				onInspect={inspect}
				editMode
				onMove={move}
			/>,
		);
		await waitFor(() =>
			expect(screen.getByText("renderer output")).toBeVisible(),
		);
		expect(screen.getByText("Partial data")).toBeVisible();
		expect(screen.getByText("Data may be out of date")).toBeVisible();
		expect(screen.getByText("A notice")).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Table" }));
		expect(screen.getByRole("table", { name: "Panel table" })).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Move Panel up" }));
		await user.click(
			screen.getByRole("button", { name: "View details for Panel" }),
		);
		await user.click(screen.getByRole("button", { name: "Refresh Panel" }));
		expect(move).toHaveBeenCalledWith("up");
		expect(inspect).toHaveBeenCalledOnce();
		expect(queryFor().refetch).not.toHaveBeenCalled();
	});

	it("renders loading, empty, error, and unknown fallback states", async () => {
		const panel = tablePanel();
		const registry = new FrontendVisualizationRegistry([]);
		const common = {
			dashboardId: "dashboard",
			panel,
			visualizations: registry,
			transformations: new FrontendTransformationRegistry([]),
			timezone: "UTC",
			editMode: false,
			onMove: vi.fn(),
		};
		const { rerender } = renderWithClient(
			<PanelShell
				{...common}
				query={queryFor({ isPending: true, data: undefined })}
			/>,
		);
		expect(screen.getByText("Loading…")).toBeVisible();
		rerender(
			<QueryClientProvider client={new QueryClient()}>
				<PanelShell
					{...common}
					query={queryFor({ data: undefined, error: new Error("failed") })}
				/>
			</QueryClientProvider>,
		);
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("failed"),
		);
		rerender(
			<QueryClientProvider client={new QueryClient()}>
				<PanelShell
					{...common}
					query={queryFor({ data: undefined, error: null })}
				/>
			</QueryClientProvider>,
		);
		expect(screen.getByText("Loading…")).toBeVisible();
		const empty = queryFor({
			data: {
				...response(),
				frames: [],
				state: {
					...response().state,
					partial: false,
					emptyReason: "no-records",
				},
			},
		});
		rerender(
			<QueryClientProvider client={new QueryClient()}>
				<PanelShell {...common} query={empty} />
			</QueryClientProvider>,
		);
		await waitFor(() =>
			expect(screen.getByText("No data for this period")).toBeVisible(),
		);
		expect(
			screen.getByText(
				"The query completed successfully but returned no rows.",
			),
		).toBeVisible();
	});

	it("keeps notices and render errors panel-local", async () => {
		const onRetry = vi.fn();
		render(
			<PanelNotices
				notices={[{ code: "A", message: "Notice", severity: "info" }]}
			/>,
		);
		expect(
			screen.getByRole("list", { name: "Panel notices" }),
		).toHaveTextContent("Notice");
		render(
			<PanelRenderErrorBoundary onRetry={onRetry}>
				<ThrowingRenderer />
			</PanelRenderErrorBoundary>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Visualization failed to render.",
		);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Retry" }));
		expect(onRetry).toHaveBeenCalledOnce();
	});
});

function ThrowingRenderer(): never {
	throw new Error("render error");
}
