import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialGameState, GameSession } from "@shared/game";
import { GameScreen } from "./GameScreen";

const mocks = vi.hoisted(() => ({
	instances: [] as Array<{ destroy: ReturnType<typeof vi.fn> }>,
	createPhaserGame: vi.fn(() => {
		const instance = { destroy: vi.fn() };
		mocks.instances.push(instance);
		return instance;
	}),
	loadPhaserGameFactory: vi.fn(async () => mocks.createPhaserGame),
}));

vi.mock("./PhaserGameLoader", () => ({
	loadPhaserGameFactory: mocks.loadPhaserGameFactory,
}));

describe("GameScreen", () => {
	it("mounts Phaser into its host and destroys every instance on cleanup", async () => {
		mocks.instances.length = 0;
		mocks.createPhaserGame.mockClear();
		mocks.loadPhaserGameFactory.mockClear();
		const session = new GameSession({
			sessionId: "test-session",
			initialState: createInitialGameState(),
		});
		const view = render(
			<StrictMode>
				<GameScreen session={session} />
			</StrictMode>,
		);

		expect(screen.getByRole("heading", { name: "Signal Ruins" })).toBeVisible();
		await waitFor(() =>
			expect(mocks.createPhaserGame).toHaveBeenCalledWith(
				screen.getByTestId("game-canvas-host"),
				session,
			),
		);
		view.unmount();

		expect(mocks.instances.length).toBeGreaterThan(0);
		for (const instance of mocks.instances) {
			expect(instance.destroy).toHaveBeenCalledOnce();
			expect(instance.destroy).toHaveBeenCalledWith(true);
		}
	});

	it("reports checkpoint transitions and removes its subscription", () => {
		const session = new GameSession({
			sessionId: "autosave-session",
			initialState: createInitialGameState(),
		});
		const onAutosave = vi.fn();
		const view = render(
			<GameScreen session={session} onAutosave={onAutosave} />,
		);

		session.dispatch({ type: "mode.enter", mode: "event" });
		expect(onAutosave).not.toHaveBeenCalled();
		session.dispatch({ type: "mode.enter", mode: "field" });
		session.dispatch({
			type: "checkpoint.reached",
			mapId: "signal-ruins",
			checkpoint: { x: 4, y: 6 },
		});
		expect(onAutosave).toHaveBeenCalledOnce();
		expect(onAutosave.mock.calls[0][0].currentMap.checkpoint).toEqual({
			x: 4,
			y: 6,
		});

		view.unmount();
		session.dispatch({
			type: "checkpoint.reached",
			mapId: "signal-ruins",
			checkpoint: { x: 5, y: 6 },
		});
		expect(onAutosave).toHaveBeenCalledOnce();
	});
});
