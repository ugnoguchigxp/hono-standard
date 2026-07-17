import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { standardFieldConfigV2Schema } from "@shared/schemas/dashboard.schema";
import type { TooltipContentProps } from "recharts";
import { resolveCartesianDomain, shouldShowCartesianAxis } from "./axis";
import {
	findCartesianSeriesForDataKey,
	formatCartesianDomain,
	formatCartesianTimeTick,
	formatCartesianTooltipValue,
	formatCartesianUnitLabel,
	formatCartesianValue,
	resolveCartesianSeriesColor,
} from "./formatters";
import { CartesianLegend } from "./legend";
import { referenceLineStrokeDash } from "./reference-lines";
import { summarizeCartesian } from "./summary";
import { CartesianTooltip, CartesianTooltipContent } from "./tooltip";

describe("Cartesian primitives", () => {
	it("formats values/domains and resolves axis/reference settings", () => {
		const config = standardFieldConfigV2Schema.parse({ decimals: 1 });
		expect(formatCartesianValue(1.2, config)).toBe("1.2");
		expect(
			[
				{ kind: "none" as const },
				{ kind: "short" as const },
				{ kind: "percent" as const, scale: "hundred" as const },
				{ kind: "bytes" as const, base: 1024 as const },
				{ kind: "duration" as const, unit: "ms" as const },
				{ kind: "rate" as const, suffix: "/s" },
				{ kind: "currency" as const, code: "USD" },
				{ kind: "custom" as const, suffix: "req" },
			].map(formatCartesianUnitLabel),
		).toEqual([
			"",
			"compact number",
			"percent",
			"bytes base 1024",
			"duration ms",
			"rate /s",
			"currency USD",
			"unit req",
		]);
		expect(formatCartesianDomain(0, "UTC")).toContain("1970");
		expect(formatCartesianTimeTick(0, [0, 60_000], "UTC", "en-US")).toMatch(
			/12:00/,
		);
		expect(
			formatCartesianTimeTick(0, [0, 25 * 60 * 60 * 1000], "UTC", "en-US"),
		).toMatch(/Jan/);
		expect(
			formatCartesianTimeTick(0, [0, 3 * 24 * 60 * 60 * 1000], "UTC", "en-US"),
		).toMatch(/Jan/);
		expect(
			resolveCartesianDomain(
				{ scale: "linear", min: "auto", max: "auto", show: true },
				true,
			),
		).toEqual([0, 100]);
		expect(
			shouldShowCartesianAxis({
				scale: "linear",
				min: "auto",
				max: "auto",
				show: true,
			}),
		).toBe(true);
		expect(
			referenceLineStrokeDash({
				value: 1,
				colorToken: "--color-muted",
				lineStyle: "dotted",
			}),
		).toBe("1 3");
		expect(
			resolveCartesianSeriesColor(
				{
					key: "a",
					frameRefId: "A",
					fieldKey: "a",
					label: "A",
					values: [1],
					fieldConfig: standardFieldConfigV2Schema.parse({
						color: { mode: "fixed", token: "--color-violet" },
					}),
				},
				0,
				{ mode: "light", palette: ["--color-brand"] },
			),
		).toBe("var(--color-violet)");
		expect(
			resolveCartesianSeriesColor(
				{
					key: "a",
					frameRefId: "A",
					fieldKey: "a",
					label: "A",
					values: [1],
					fieldConfig: config,
				},
				1,
				{ mode: "light", palette: ["--color-brand", "--color-cyan"] },
			),
		).toBe("var(--color-cyan)");
	});
	it("builds a bounded accessible summary", () => {
		const model = {
			domainKind: "category" as const,
			rows: [
				{
					domain: "a",
					values: { value: 1, other: 3 },
					raw: {},
				},
			],
			series: [
				{
					key: "value",
					frameRefId: "A",
					fieldKey: "value",
					label: "Value",
					values: [1],
					fieldConfig: standardFieldConfigV2Schema.parse({}),
				},
				{
					key: "other",
					frameRefId: "A",
					fieldKey: "other",
					label: "Other",
					values: [3],
					fieldConfig: standardFieldConfigV2Schema.parse({}),
				},
			],
		};
		expect(summarizeCartesian(model, "line")).toContain("line");
		expect(summarizeCartesian(model, "percent-stacked")).toContain("25%");
		expect(
			summarizeCartesian(model, "waterfall", "en-US", "UTC", {
				waterfall: { valueKey: "value" },
			}),
		).toContain("net change 1");
		expect(
			summarizeCartesian(model, "range-band", "en-US", "UTC", {
				rangeBand: { lowerKey: "value", upperKey: "other" },
			}),
		).toContain("width 2");
		expect(summarizeCartesian(model, "sparkline")).toContain("flat");
		expect(summarizeCartesian(model, "horizontal")).toContain("minimum a");
		expect(summarizeCartesian(model, "lollipop")).toContain("maximum a");
		expect(summarizeCartesian(model, "stacked")).toContain("total 4");
		expect(summarizeCartesian(model, "grouped")).toContain("1 categories");
		const series = model.series[0];
		expect(series).toBeDefined();
		if (!series) return;
		expect(findCartesianSeriesForDataKey(model, "values.value")).toBe(series);
		expect(findCartesianSeriesForDataKey(model, 1)).toBeUndefined();
		expect(
			formatCartesianTooltipValue(
				1,
				{
					...series,
					fieldConfig: standardFieldConfigV2Schema.parse({
						valueMappings: [{ kind: "value", value: 1, text: "Healthy" }],
					}),
				},
				"en-US",
				"UTC",
			),
		).toEqual({ value: "Healthy", detail: "raw 1" });
	});
	it("provides keyboard-operable legend and tooltip alternatives", async () => {
		const toggle = vi.fn();
		const isolate = vi.fn();
		render(
			<CartesianLegend
				series={[{ key: "a", label: "A" }]}
				hidden={new Set()}
				onToggle={toggle}
				onIsolate={isolate}
				onReset={vi.fn()}
			/>,
		);
		await screen.getByRole("button", { name: "A" }).click();
		expect(toggle).toHaveBeenCalledWith("a");
		screen.getByRole("button", { name: "A" }).dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Enter",
				shiftKey: true,
				bubbles: true,
			}),
		);
		expect(isolate).toHaveBeenCalledWith("a");
		render(
			<CartesianTooltipContent
				domain="Jan 1"
				rows={Array.from({ length: 21 }, (_, index) => ({
					key: `series-${index}`,
					label: `Series ${index}`,
					value: String(index),
				}))}
			/>,
		);
		expect(screen.getByRole("status")).toHaveTextContent("Jan 1");
		expect(screen.getByRole("status")).toHaveTextContent("+1 more");
		const tooltipProps = {
			active: true,
			label: "a",
			payload: [{ dataKey: "value", value: 1 }],
		} as unknown as TooltipContentProps;
		render(
			<CartesianTooltip
				{...tooltipProps}
				formatDomain={String}
				formatRow={() => ({
					key: "value",
					label: "Value",
					value: "1",
				})}
			/>,
		);
		expect(screen.getAllByRole("status")).toHaveLength(2);
	});
});
