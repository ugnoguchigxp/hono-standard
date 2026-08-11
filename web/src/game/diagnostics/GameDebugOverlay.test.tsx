import type { GameSession } from "@shared/game";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameDebugOverlay } from "./GameDebugOverlay";

describe("GameDebugOverlay", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("samples FPS and pending saves while following semantic session changes", () => {
		let frameCallback: FrameRequestCallback | undefined;
		const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			frameCallback = callback;
			return 7;
		});
		const cancelAnimationFrame = vi.fn();
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
		vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

		let listener: (() => void) | undefined;
		const state = {
			location: { mapId: "signal-ruins" },
			field: { partyPositions: [{ x: 26, y: 17 }] },
			mode: "field",
			revision: 4,
			rng: { draws: 9 },
		};
		const session = {
			sequence: 6,
			snapshot: () => structuredClone(state),
			subscribe: (next: () => void) => {
				listener = next;
				return () => {
					listener = undefined;
				};
			},
		} as unknown as GameSession;
		const startedAt = performance.now();
		const view = render(
			<GameDebugOverlay session={session} getPendingSaveCount={() => 2} />,
		);

		expect(screen.getByText(/signal-ruins @26,17/)).toHaveTextContent(
			"r4/s6 · rng 9 · 0fps · saveq 2",
		);
		act(() => frameCallback?.(startedAt + 20));
		act(() => frameCallback?.(startedAt + 1_020));
		expect(screen.getByText(/signal-ruins @26,17/)).toHaveTextContent(
			"2fps · saveq 2",
		);

		state.location.mapId = "relay-camp";
		state.field.partyPositions = [];
		state.revision = 5;
		state.rng.draws = 10;
		act(() => listener?.());
		expect(screen.getByText(/relay-camp @-/)).toHaveTextContent(
			"r5/s6 · rng 10",
		);

		view.unmount();
		expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
		expect(listener).toBeUndefined();
	});
});
