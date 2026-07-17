// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	dataFrame,
	numberField,
	stringField,
	timeField,
} from "../../../../../../api/modules/dashboard/v2/frame-builders";
import { tablePanel } from "../test/fixtures";
import { LogsRenderer, TraceRenderer } from "./specialized-renderer";
import "../test/setup";

const interaction = {
	hiddenFieldKeys: new Set<string>(),
	toggleField: () => undefined,
	isolateField: () => undefined,
	resetFields: () => undefined,
	onDatumActivate: () => undefined,
};

describe("specialized renderer windowing", () => {
	it("keeps mounted log rows below the hard limit while scrolling", () => {
		const count = 200;
		const frame = dataFrame({
			refId: "A",
			name: "Logs",
			shapeHint: "logs",
			fields: [
				timeField("time", Array.from({ length: count }, (_, index) => index), {
					roles: ["time"],
				}),
				stringField(
					"message",
					Array.from({ length: count }, (_, index) => `message ${index}`),
					{ roles: ["message"] },
				),
			],
		});
		const context: Parameters<typeof LogsRenderer>[0] = {
			dashboardId: "dashboard",
			panel: {
				...tablePanel(),
				visualization: {
					...tablePanel().visualization,
					type: "observability.logs",
					frameRefs: ["A"],
				},
			},
			frames: [frame as never],
			preset: "compact",
			config: {
				order: "ascending",
				wrap: false,
				showTimestamp: true,
				showAttributes: false,
				attributeFields: [],
				maxMessageCharacters: 240,
			},
			timezone: "UTC",
			locale: "en-US",
			theme: { mode: "dark", palette: [] },
			interaction,
		};
		const { container } = render(<LogsRenderer {...context} />);
		const viewport = container.querySelector(".dashboard-log-viewport");
		expect(viewport).not.toBeNull();
		expect(container.querySelectorAll(".dashboard-log-row").length).toBeLessThanOrEqual(80);
		fireEvent.scroll(viewport as Element, { target: { scrollTop: 4_000 } });
		expect(container.textContent).toContain("message 142");
		expect(container.querySelectorAll(".dashboard-log-row").length).toBeLessThanOrEqual(80);
	});

	it("keeps mounted trace rows below the hard limit", () => {
		const count = 200;
		const frame = dataFrame({
			refId: "A",
			name: "Trace",
			shapeHint: "traces",
			fields: [
				stringField("trace", Array(count).fill("trace"), { roles: ["trace-id"] }),
				stringField(
					"span",
					Array.from({ length: count }, (_, index) => `span-${index}`),
					{ roles: ["span-id"] },
				),
				stringField("operation", Array(count).fill("operation"), {
					roles: ["operation"],
				}),
				stringField("service", Array(count).fill("api"), { roles: ["service"] }),
				timeField("start", Array.from({ length: count }, (_, index) => index), {
					roles: ["start-time"],
				}),
				numberField("duration", Array(count).fill(1), {
					roles: ["duration"],
					config: { unit: { kind: "duration", unit: "ms" } },
				}),
			],
		});
		const context: Parameters<typeof TraceRenderer>[0] = {
			dashboardId: "dashboard",
			panel: {
				...tablePanel(),
				visualization: {
					...tablePanel().visualization,
					type: "observability.trace-waterfall",
					frameRefs: ["A"],
				},
			},
			frames: [frame as never],
			preset: "waterfall",
			config: {
				order: "tree",
				showService: true,
				showIdle: false,
				minDurationPercent: 0,
				attributeFields: [],
			},
			timezone: "UTC",
			locale: "en-US",
			theme: { mode: "dark", palette: [] },
			interaction,
		};
		const { container } = render(<TraceRenderer {...context} />);
		expect(container.querySelectorAll("svg g").length).toBeLessThanOrEqual(100);
	});
});
