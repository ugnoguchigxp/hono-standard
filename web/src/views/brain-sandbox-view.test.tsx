import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render-with-providers";
import { BrainSandboxView } from "./brain-sandbox-view";
const telemetry = vi.hoisted(() => ({
	value: {
		connected: false,
		snapshot: undefined as Record<string, unknown> | undefined,
		error: undefined as string | undefined,
	},
}));
vi.mock("../domains/brain-sandbox/use-telemetry", () => ({
	useTelemetry: () => telemetry.value,
}));
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
beforeEach(() => {
	telemetry.value = { connected: false, snapshot: undefined, error: undefined };
	vi.stubGlobal("fetch", vi.fn());
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
		context as never,
	);
});
it("renders controls and visualizes a telemetry fixture", async () => {
	telemetry.value = {
		connected: true,
		error: undefined,
		snapshot: {
			body: { energy: 0.5, hunger: 0.4, fatigue: 0.3, matingDrive: 0.2 },
			world: {
				width: 32,
				height: 32,
				agent: { x: 1, y: 1, direction: 0 },
				entities: { food: [], shelter: [], mate: [], danger: [] },
			},
			neurons: [],
			synapses: [],
		},
	};
	const fetchMock = vi.mocked(fetch);
	fetchMock.mockResolvedValueOnce(
		new Response(JSON.stringify({ items: [] }), { status: 200 }),
	);
	fetchMock.mockResolvedValueOnce(
		new Response(
			JSON.stringify({
				runId: "run",
				status: "paused",
				revision: 0,
				simTimeMs: 0,
				seed: 1,
			}),
			{ status: 201 },
		),
	);
	renderWithProviders(<BrainSandboxView />);
	fireEvent.click(screen.getByRole("button", { name: "Create experiment" }));
	expect(
		screen.getByRole("heading", { name: "Organic Brain Sandbox" }),
	).toBeVisible();
	await waitFor(() =>
		expect(screen.getByLabelText("Experiment world")).toBeVisible(),
	);
	expect(screen.getByLabelText("Neural network map")).toBeVisible();
});

it("selects a durable run and opens its neuron inspector", async () => {
	const fetchMock = vi.mocked(fetch);
	fetchMock
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					items: [
						{
							runId: "saved",
							status: "completed",
							revision: 2,
							simTimeMs: 50,
							seed: 8,
						},
					],
				}),
				{ status: 200 },
			),
		)
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ neuron: { id: 3 }, incoming: [], outgoing: [] }),
				{
					status: 200,
				},
			),
		);
	renderWithProviders(<BrainSandboxView />);
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: /8.*completed.*50/ }),
		).toBeVisible(),
	);
	fireEvent.click(screen.getByRole("button", { name: /8.*completed.*50/ }));
	fireEvent.change(screen.getByLabelText("Neuron ID"), {
		target: { value: "3" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Inspect neuron" }));
	await waitFor(() => expect(screen.getByText(/"id": 3/)).toBeVisible());
});
