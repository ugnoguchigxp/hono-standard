import { MockSignalSimulator } from "@api/modules/observatory/mock/simulator";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSceneModel, type Selection } from "./scene-model";
import { SceneHost } from "./scene-host";

const canvas = vi.hoisted(() => ({
	behavior: "render" as "render" | "throw-chunk" | "throw-other" | "lose",
}));
vi.mock("./scene-canvas", () => ({
	SceneCanvas: ({ onContextLost }: { onContextLost: () => void }) => {
		if (canvas.behavior === "throw-chunk")
			throw new Error("Failed to fetch dynamically imported module");
		if (canvas.behavior === "throw-other") throw new Error("render failed");
		return (
			<button type="button" onClick={onContextLost}>
				scene canvas
			</button>
		);
	},
}));

const model = buildSceneModel(
	new MockSignalSimulator({
		seed: 42,
		initialTime: 1_700_000_000_000,
	}).snapshot(),
);

const stubWebgl = (available: boolean) =>
	vi
		.spyOn(HTMLCanvasElement.prototype, "getContext")
		.mockImplementation((() =>
			available ? { getExtension: () => null } : null) as never);

const renderHost = (selected: Selection = null, onSelect = vi.fn()) =>
	render(
		<SceneHost
			model={model}
			selected={selected}
			onSelect={onSelect}
			active
		/>,
	);

afterEach(() => {
	canvas.behavior = "render";
	vi.restoreAllMocks();
});

describe("SceneHost", () => {
	it("falls back to the lists when WebGL is unavailable", () => {
		stubWebgl(false);
		renderHost();
		expect(screen.getByRole("status")).toHaveTextContent(
			"WebGL is unavailable on this device.",
		);
		expect(screen.queryByRole("button", { name: "Retry scene" })).toBeNull();
	});

	it("treats a throwing WebGL probe as unsupported", () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
			() => {
				throw new Error("blocked");
			},
		);
		renderHost();
		expect(screen.getByRole("status")).toHaveTextContent("WebGL is unavailable");
	});

	it("recovers after the graphics context is lost", async () => {
		stubWebgl(true);
		renderHost();
		fireEvent.click(await screen.findByRole("button", { name: "scene canvas" }));
		expect(screen.getByRole("status")).toHaveTextContent(
			"The graphics context was lost.",
		);
		fireEvent.click(screen.getByRole("button", { name: "Retry scene" }));
		expect(
			await screen.findByRole("button", { name: "scene canvas" }),
		).toBeInTheDocument();
	});

	it("reloads the page when the scene chunk fails to load", async () => {
		stubWebgl(true);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const reload = vi.fn();
		vi.spyOn(window, "location", "get").mockReturnValue({
			...window.location,
			reload,
		});
		canvas.behavior = "throw-chunk";
		renderHost();
		fireEvent.click(await screen.findByRole("button", { name: "Retry scene" }));
		expect(reload).toHaveBeenCalled();
	});

	it("remounts the scene after a render failure", async () => {
		stubWebgl(true);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		canvas.behavior = "throw-other";
		renderHost();
		expect(await screen.findByRole("status")).toHaveTextContent(
			"The scene could not be displayed.",
		);
		canvas.behavior = "render";
		fireEvent.click(screen.getByRole("button", { name: "Retry scene" }));
		expect(
			await screen.findByRole("button", { name: "scene canvas" }),
		).toBeInTheDocument();
	});

	it.each([
		["entity", model.entities[0]!.id, undefined, model.entities[0]!.label],
		[
			"stage",
			model.stages[0]!.id,
			model.stages[0]!.pipelineId,
			model.stages[0]!.label,
		],
		[
			"pipeline",
			model.pipelines[0]!.id,
			undefined,
			model.pipelines[0]!.label,
		],
		["task", model.tasks[0]!.id, undefined, model.tasks[0]!.label],
	] as const)("identifies a selected %s", (kind, id, pipelineId, name) => {
		stubWebgl(false);
		const onSelect = vi.fn();
		renderHost({ kind, id, pipelineId }, onSelect);
		const aside = screen.getByRole("complementary", { name: "Selected object" });
		expect(aside).toHaveTextContent(name);
		fireEvent.click(screen.getByRole("button", { name: "Close selected object" }));
		expect(onSelect).toHaveBeenCalledWith(null);
	});

	it("identifies a selected boundary by its endpoint labels", () => {
		stubWebgl(false);
		const boundary = model.boundaries[0]!;
		const source = model.entities.find((item) => item.id === boundary.source);
		renderHost({ kind: "boundary", id: boundary.id });
		expect(
			screen.getByRole("complementary", { name: "Selected object" }),
		).toHaveTextContent(`${source?.label ?? boundary.source} →`);
	});

	it("renders nothing for a selection that no longer exists", () => {
		stubWebgl(false);
		for (const kind of ["entity", "stage", "pipeline", "task", "boundary"] as const) {
			const { unmount } = renderHost({ kind, id: "missing" });
			expect(
				screen.queryByRole("complementary", { name: "Selected object" }),
			).toBeNull();
			unmount();
		}
	});
});
