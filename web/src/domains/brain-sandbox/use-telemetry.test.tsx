import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchWithSession = vi.hoisted(() => vi.fn());
vi.mock("../../api", () => ({ fetchWithSession }));

import { useTelemetry } from "./use-telemetry";

function Probe({ runId }: { runId?: string }) {
	const state = useTelemetry(runId);
	return <output>{JSON.stringify(state)}</output>;
}

afterEach(() => {
	vi.restoreAllMocks();
	fetchWithSession.mockReset();
});

describe("useTelemetry", () => {
	it("receives snapshot and batch events from the protected stream", async () => {
		const encoder = new TextEncoder();
		let sent = false;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (sent) return controller.close();
				sent = true;
				controller.enqueue(
					encoder.encode(
						'event: snapshot\ndata: {"simTimeMs":0}\n\nevent: batch\ndata: {"simTimeMs":100}\n\n',
					),
				);
			},
		});
		fetchWithSession.mockResolvedValue({ ok: true, body });
		render(<Probe runId="run-1" />);
		await waitFor(() =>
			expect(screen.getByText(/"simTimeMs":100/)).toBeInTheDocument(),
		);
		expect(fetchWithSession).toHaveBeenCalledWith(
			"/api/experiments/run-1/events",
			expect.objectContaining({ credentials: "include" }),
		);
	});

	it("does not reconnect after an authorization failure", async () => {
		fetchWithSession.mockResolvedValue({ ok: false, status: 401, body: null });
		render(<Probe runId="run-2" />);
		await waitFor(() =>
			expect(screen.getByText(/Unauthorized/)).toBeInTheDocument(),
		);
		expect(fetchWithSession).toHaveBeenCalledTimes(1);
	});

	it("stays disconnected without a selected run", () => {
		render(<Probe />);
		expect(screen.getByText(/"connected":false/)).toBeInTheDocument();
		expect(fetchWithSession).not.toHaveBeenCalled();
	});
});
