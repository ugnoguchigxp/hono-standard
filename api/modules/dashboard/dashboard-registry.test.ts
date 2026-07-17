import { describe, expect, it } from "vitest";
import { DashboardRegistry, DashboardRegistryError } from "./dashboard-registry";
import { defineDashboard } from "./define-dashboard";

const panel = (id: string, targetId?: string) => ({
	manifest: {
		id,
		title: id,
		description: "",
		layout: { x: 0, y: 0, w: 4, h: 3 },
		queryId: `${id}-query`,
		accessibleLabel: id,
		visualization: {
			type: "line" as const,
			unit: "",
			decimalPlaces: 2,
			showLegend: true,
			thresholds: [],
			valueMappings: [],
			referenceLines: [],
			fill: "null" as const,
			connectNulls: false,
			yAxisScale: "linear" as const,
			yAxisMin: "auto" as const,
			yAxisMax: "auto" as const,
			links: targetId
				? [{ targetId, to: "/protected", search: {}, includeRange: false, includeFilters: false }]
				: [],
		},
	},
	handler: () => ({ kind: "stat" as const, value: 1 }),
});

const dashboard = (panels = [panel("requests")]) =>
	defineDashboard({
		manifest: {
			id: "operations",
			title: "Operations",
			description: "",
			layoutVersion: 1,
			defaultRange: { kind: "relative", value: "1h" },
			defaultTimezone: "UTC",
			defaultRefreshSeconds: 0,
			variables: [],
			panels: panels.map((item) => item.manifest),
			inspectorEnabled: true,
		},
		variables: [],
		panels,
	});

describe("DashboardRegistry", () => {
	it("indexes dashboards and validates link targets", () => {
		const registry = new DashboardRegistry([dashboard([panel("requests"), panel("errors", "requests")])]);
		expect(registry.getManifest("operations")?.title).toBe("Operations");
		expect(registry.getPanel("operations", "errors")?.manifest.queryId).toBe("errors-query");
	});

	it("rejects duplicate panel and query ids", () => {
		expect(() => new DashboardRegistry([dashboard([panel("requests"), panel("requests")])])).toThrow(DashboardRegistryError);
	});

	it("rejects unknown link targets", () => {
		expect(() => new DashboardRegistry([dashboard([panel("requests", "missing")])])).toThrow(/Unknown link target/);
	});

	it("rejects dependency cycles", () => {
		const makeVariable = (id: string, dependsOn: string[]) => ({
			manifest: {
				id,
				label: id,
				selection: "single" as const,
				required: false,
				defaultValues: [],
				dependsOn,
				source: { kind: "static" as const, options: [{ value: "x", label: "X" }] },
			},
		});
		const base = dashboard();
		expect(() => new DashboardRegistry([{ ...base, variables: [makeVariable("a", ["b"]), makeVariable("b", ["a"])] }])).toThrow(/dependency/);
	});

	it("checks static defaults and sorts query options", async () => {
		const base = dashboard();
		const invalid = {
			...base,
			variables: [
				{
					manifest: {
						id: "service",
						label: "Service",
						selection: "single" as const,
						required: true,
						defaultValues: ["missing"],
						dependsOn: [],
						source: { kind: "static" as const, options: [{ value: "api", label: "API" }] },
					},
				},
			],
		};
		expect(() => new DashboardRegistry([invalid])).toThrow(/default/);

		const query = {
			...base,
			variables: [
				{
					manifest: {
						id: "service",
						label: "Service",
						selection: "single" as const,
						required: false,
						defaultValues: [],
						dependsOn: [],
						source: { kind: "query" as const, queryId: "service-options" },
					},
					options: async () => [
						{ value: "z", label: "Zulu" },
						{ value: "a", label: "Alpha" },
					],
				},
			],
		};
		const registry = new DashboardRegistry([query]);
		expect((await registry.getVariableOptions("operations", "service", { range: { from: new Date(0), to: new Date(1_000) }, timezone: "UTC", dependsOn: {}, filters: {}, signal: new AbortController().signal, now: () => new Date() })).map((item) => item.value)).toEqual(["a", "z"]);
	});
});
