import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NeuralCanvas } from "./neural-canvas";
import { Timeline } from "./timeline";

const context = {
	scale: vi.fn(),
	fillRect: vi.fn(),
	beginPath: vi.fn(),
	moveTo: vi.fn(),
	lineTo: vi.fn(),
	stroke: vi.fn(),
	arc: vi.fn(),
	fill: vi.fn(),
	set fillStyle(_value: string) {},
	set strokeStyle(_value: string) {},
	set lineWidth(_value: number) {},
	set globalAlpha(_value: number) {},
};

afterEach(() => vi.restoreAllMocks());

describe("brain sandbox visuals", () => {
	it("draws bounded weighted edges and role-aware neurons", () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
			context as never,
		);
		render(
			<NeuralCanvas
				neurons={[
					{
						id: 1,
						type: "excitatory",
						role: "internal",
						position: { x: 0.1, y: 0.2 },
						activity: 1,
					},
					{
						id: 2,
						type: "inhibitory",
						role: "motor",
						position: { x: 0.5, y: 0.7 },
						activity: 2,
					},
				]}
				synapses={[
					{ source: 1, target: 2, weight: 0.5, type: "excitatory" },
					{ source: 1, target: 9, weight: 0.8, type: "inhibitory" },
					{ source: 2, target: 1, weight: 0.1, type: "inhibitory" },
				]}
			/>,
		);
		expect(screen.getByLabelText("Neural network map")).toBeVisible();
		expect(context.lineTo).toHaveBeenCalledTimes(1);
		expect(context.arc).toHaveBeenCalledTimes(2);
	});

	it("renders default and populated timeline metrics", () => {
		const { rerender } = render(<Timeline />);
		expect(screen.getByText("Simulation time: 0 ms")).toBeVisible();
		rerender(
			<Timeline
				simTimeMs={300}
				counters={{ spikes: 4 }}
				actions={[
					{ atMs: 100, action: "eat", succeeded: true },
					{ atMs: 200, action: "rest", succeeded: false },
				]}
			/>,
		);
		expect(screen.getByText("spikes")).toBeVisible();
		expect(screen.getByText("100 ms — eat (success)")).toBeVisible();
		expect(screen.getByText("200 ms — rest (no effect)")).toBeVisible();
	});
});
