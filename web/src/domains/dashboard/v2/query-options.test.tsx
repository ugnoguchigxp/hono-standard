// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	prefetchDashboardManifestV2,
	useDashboardManifestV2,
	useDashboardPanelsV2,
	useDashboardVariablesV2,
} from "./query-options";
import { tableFrame, tablePanel } from "./test/fixtures";
import "./test/setup";

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<QueryClientProvider
		client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
	>
		{children}
	</QueryClientProvider>
);
const manifest = {
	schemaVersion: 2 as const,
	revision: 1,
	id: "dashboard",
	title: "Dashboard",
	description: "",
	layoutVersion: 1,
	defaultRange: { kind: "relative" as const, value: "1h" as const },
	defaultTimezone: "UTC",
	defaultRefreshSeconds: 0,
	variables: [],
	panels: [tablePanel()],
	inspectorEnabled: true,
};
describe("Dashboard v2 query options", () => {
	it("loads the manifest and panel query with query keys", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
			String(input).includes("/query")
				? new Response(
						JSON.stringify({
							schemaVersion: 2,
							requestId: "11111111-1111-4111-8111-111111111111",
							generatedAt: "2026-07-16T00:00:00.000Z",
							resolvedRange: {
								from: "2026-07-16T00:00:00.000Z",
								to: "2026-07-16T01:00:00.000Z",
							},
							durationMs: 1,
							counts: { frames: 1, fields: 2, rows: 2, cells: 4 },
							state: { partial: false, truncated: false, notices: [] },
							frames: [
								tableFrame([
									{ name: "a", value: 1 },
									{ name: "b", value: 2 },
								]),
							],
						}),
					)
				: new Response(JSON.stringify(manifest)),
		);
		const manifestHook = renderHook(() => useDashboardManifestV2("dashboard"), {
			wrapper,
		});
		await waitFor(() =>
			expect(manifestHook.result.current.data?.id).toBe("dashboard"),
		);
		const panelHook = renderHook(
			() =>
				useDashboardPanelsV2(
					"dashboard",
					manifest,
					{
						schemaVersion: 2,
						range: { kind: "relative", value: "1h" },
						timezone: "UTC",
						filters: {},
						maxDataPoints: 10,
						maxRows: 10,
					},
					0,
				),
			{ wrapper },
		);
		await waitFor(() =>
			expect(panelHook.result.current[0]?.data?.schemaVersion).toBe(2),
		);
		vi.restoreAllMocks();
	});
	it("requests static variable options from the v2 endpoint", async () => {
		const staticManifest = {
			...manifest,
			variables: [
				{
					id: "service",
					label: "Service",
					selection: "single" as const,
					required: true,
					defaultValues: ["api"],
					dependsOn: [],
					source: { kind: "static" as const },
				},
			],
		};
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					schemaVersion: 2,
					variableId: "service",
					options: [{ value: "api", label: "API", disabled: false }],
				}),
			),
		);
		const hooks = renderHook(
			() =>
				useDashboardVariablesV2(
					"dashboard",
					staticManifest,
					{ kind: "relative", value: "1h" },
					"UTC",
					{},
				),
			{ wrapper },
		);
		expect(hooks.result.current).toHaveLength(1);
		await waitFor(() =>
			expect(hooks.result.current[0]?.data?.options[0]?.value).toBe("api"),
		);
		expect(fetchMock).toHaveBeenCalledOnce();
		vi.restoreAllMocks();
	});
	it("respects variable dependencies and prefetches the manifest", async () => {
		const dynamicManifest = {
			...manifest,
			variables: [
				{
					id: "service",
					label: "Service",
					selection: "single" as const,
					required: true,
					defaultValues: ["api"],
					dependsOn: [],
					source: { kind: "static" as const },
				},
				{
					id: "region",
					label: "Region",
					selection: "multiple" as const,
					required: false,
					defaultValues: [],
					dependsOn: ["service"],
					source: { kind: "query" as const, queryId: "regions" },
				},
			],
		};
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
			async (input) =>
				new Response(
					JSON.stringify(
						String(input).includes("/service/")
							? {
									schemaVersion: 2,
									variableId: "service",
									options: [{ value: "api", label: "API" }],
								}
							: {
									schemaVersion: 2,
									variableId: "region",
									options: [{ value: "apac", label: "APAC" }],
								},
					),
				),
		);
		const disabled = renderHook(
			() =>
				useDashboardVariablesV2(
					"dashboard",
					dynamicManifest,
					{ kind: "relative", value: "1h" },
					"UTC",
					{},
				),
			{ wrapper },
		);
		await waitFor(() =>
			expect(disabled.result.current[0]?.data?.variableId).toBe("service"),
		);
		expect(
			fetchMock.mock.calls.some(([input]) =>
				String(input).includes("/region/"),
			),
		).toBe(false);
		const enabled = renderHook(
			() =>
				useDashboardVariablesV2(
					"dashboard",
					dynamicManifest,
					{ kind: "relative", value: "1h" },
					"UTC",
					{ service: ["api"] },
				),
			{ wrapper },
		);
		await waitFor(() =>
			expect(enabled.result.current[1]?.data?.variableId).toBe("region"),
		);
		const client = new QueryClient();
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(manifest)));
		await prefetchDashboardManifestV2(client, "dashboard");
		expect(
			client.getQueryData(["dashboard-v2", "dashboard", "manifest"]),
		).toBeTruthy();
		void disabled;
		vi.restoreAllMocks();
	});
});
