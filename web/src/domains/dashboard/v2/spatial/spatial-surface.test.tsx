import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpatialData } from "./spatial-state";
import { SpatialSurface } from "./spatial-surface";
import type { ConnectionStatus } from "./use-spatial-data";

const hook = vi.hoisted(() => ({
	value: {
		data: null as SpatialData | null,
		status: "loading" as ConnectionStatus,
		retry: () => undefined,
	},
}));
vi.mock("./use-spatial-data", () => ({ useSpatialData: () => hook.value }));
vi.mock("./scene-host", () => ({
	SceneHost: ({ active }: { active: boolean }) => (
		<p>scene host {active ? "active" : "paused"}</p>
	),
}));
vi.mock("./scenario-select", () => ({
	ScenarioSelect: ({ current }: { current: string }) => <p>scenario {current}</p>,
}));

const snapshot = () =>
	new MockSignalSimulator({
		seed: 42,
		initialTime: 1_700_000_000_000,
	}).snapshot();

const setHook = (
	data: SpatialData | null,
	status: ConnectionStatus,
	retry = vi.fn(),
) => {
	hook.value = { data, status, retry };
	return retry;
};

const details = () =>
	screen.getByRole("complementary", { name: "Selected signal details" });

afterEach(() => setHook(null, "loading"));

describe("SpatialSurface", () => {
	it("shows loading state and retries the connection", () => {
		const retry = setHook(null, "offline");
		render(<SpatialSurface />);
		expect(screen.getByText("Loading spatial state…")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(retry).toHaveBeenCalled();
	});

	it("explains expired sessions", () => {
		setHook(null, "unauthorized");
		render(<SpatialSurface />);
		expect(screen.getByRole("alert")).toHaveTextContent("session has expired");
	});

	it("marks stale data and pauses the scene", async () => {
		setHook({ snapshot: snapshot(), events: [], lastSequence: 0 }, "stale");
		render(<SpatialSurface />);
		expect(
			screen.getByText("Showing last known state. Live updates are unavailable."),
		).toBeInTheDocument();
		expect(await screen.findByText("scene host paused")).toBeInTheDocument();
	});

	it("summarizes a live snapshot and its events", async () => {
		const current = snapshot();
		const event = {
			schemaVersion: 1,
			id: `${current.instanceId}:1`,
			instanceId: current.instanceId,
			sequence: 1,
			timestamp: current.generatedAt,
			kind: "task.completed",
			source: "agent-core",
			severity: "info",
		} as SpatialData["events"][number];
		setHook({ snapshot: current, events: [event], lastSequence: 1 }, "live");
		const { container } = render(<SpatialSurface />);
		expect(container.querySelector("main")).toHaveAttribute(
			"data-spatial-ready",
			"true",
		);
		expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
		expect(await screen.findByText("scene host active")).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "System summary" }),
		).toHaveTextContent(`Entities: ${current.entities.length}`);
		expect(
			screen.getByRole("region", { name: "Recent events" }),
		).toHaveTextContent("task.completed from agent-core");
	});

	it("shows details for each selectable kind and closes them", () => {
		const current = snapshot();
		setHook({ snapshot: current, events: [], lastSequence: 0 }, "live");
		render(<SpatialSurface />);
		const section = (name: string) => screen.getByRole("region", { name });

		const entity = current.entities[0]!;
		fireEvent.click(
			within(section("Entities")).getAllByRole("button")[0]!,
		);
		expect(details()).toHaveTextContent(entity.label);
		expect(details()).toHaveTextContent("Health");

		fireEvent.click(within(section("Boundaries")).getAllByRole("button")[0]!);
		expect(details()).toHaveTextContent("Latency");

		fireEvent.click(within(section("Tasks")).getAllByRole("button")[0]!);
		expect(details()).toHaveTextContent("Task state");

		const pipelineButtons = within(section("Pipelines")).getAllByRole("button");
		fireEvent.click(pipelineButtons[0]!);
		expect(details()).toHaveTextContent("Stages");
		fireEvent.click(pipelineButtons[1]!);
		expect(details()).toHaveTextContent("Queue depth");

		fireEvent.click(screen.getByRole("button", { name: "Close details" }));
		expect(
			screen.queryByRole("complementary", { name: "Selected signal details" }),
		).toBeNull();
	});

	it("clears a selection that disappears from the next snapshot", () => {
		const current = snapshot();
		setHook({ snapshot: current, events: [], lastSequence: 0 }, "live");
		const { rerender } = render(<SpatialSurface />);
		fireEvent.click(
			within(screen.getByRole("region", { name: "Tasks" })).getAllByRole(
				"button",
			)[0]!,
		);
		expect(details()).toBeInTheDocument();
		setHook(
			{ snapshot: { ...current, tasks: [] }, events: [], lastSequence: 0 },
			"live",
		);
		rerender(<SpatialSurface />);
		expect(
			screen.queryByRole("complementary", { name: "Selected signal details" }),
		).toBeNull();
	});
});
