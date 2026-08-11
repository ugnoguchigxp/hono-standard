import {
	createDemoEncounterProvider,
	createInitialGameState,
	GameSession,
} from "@shared/game";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { validateGameContentDirectory } from "../../../scripts/validate-game-content";
import { GameScreen } from "./GameScreen";
import { gameSettingsStore } from "./settings/GameSettingsStore";

const registry = validateGameContentDirectory();
const createSession = (sessionId: string) =>
	new GameSession({
		sessionId,
		initialState: createInitialGameState({ registry }),
		registry,
		encounterProvider: createDemoEncounterProvider(),
	});

const mocks = vi.hoisted(() => ({
	instances: [] as Array<{ destroy: ReturnType<typeof vi.fn> }>,
	createPhaserGame: vi.fn((..._args: unknown[]) => {
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
	it("opens the persistent interface settings and applies screen options", async () => {
		gameSettingsStore.reset();
		const session = createSession("settings-session");
		const view = render(
			<GameScreen session={session} onExit={() => undefined} />,
		);

		const settingsButton = screen.getByRole("button", { name: "Settings" });
		settingsButton.focus();
		fireEvent.click(settingsButton);
		const dialog = screen.getByRole("dialog", { name: "Game settings" });
		expect(dialog).toBeVisible();
		expect(dialog.closest(".game-frame")).not.toBeNull();
		expect(
			screen.getByRole("button", { name: "Close settings" }),
		).toHaveFocus();
		fireEvent.change(screen.getByLabelText("Screen scale"), {
			target: { value: "2" },
		});
		fireEvent.click(screen.getByLabelText("High contrast"));
		expect(
			screen.getByRole("region", { name: "Signal Ruins" }),
		).toHaveAttribute("data-screen-scale", "2");
		expect(
			screen.getByRole("region", { name: "Signal Ruins" }),
		).toHaveAttribute("data-high-contrast", "true");
		fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
		expect(
			screen.getByRole("button", { name: "Restore defaults" }),
		).toHaveFocus();
		fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
		expect(screen.queryByRole("dialog", { name: "Game settings" })).toBeNull();
		expect(settingsButton).toHaveFocus();
		view.unmount();
		gameSettingsStore.reset();
	});

	it("mounts Phaser into its host and destroys every instance on cleanup", async () => {
		mocks.instances.length = 0;
		mocks.createPhaserGame.mockClear();
		mocks.loadPhaserGameFactory.mockClear();
		const session = createSession("test-session");
		const view = render(
			<StrictMode>
				<GameScreen session={session} onExit={() => undefined} />
			</StrictMode>,
		);

		expect(screen.getByRole("heading", { name: "Signal Ruins" })).toBeVisible();
		expect(screen.getByText(/X \/ Esc \/ M/)).toBeVisible();
		expect(screen.getByTestId("game-canvas-host")).toHaveAttribute(
			"data-game-mode",
			"field",
		);
		await waitFor(() =>
			expect(mocks.createPhaserGame).toHaveBeenCalledWith(
				screen.getByTestId("game-canvas-host"),
				session,
				expect.anything(),
				expect.any(Function),
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
		const session = createSession("autosave-session");
		const onAutosave = vi.fn();
		const view = render(
			<GameScreen
				session={session}
				onAutosave={onAutosave}
				onExit={() => undefined}
			/>,
		);

		session.dispatch({
			type: "story.flag.set",
			flagId: "non-checkpoint-change",
			value: true,
		});
		expect(onAutosave).not.toHaveBeenCalled();
		session.dispatch({
			type: "checkpoint.reached",
			checkpointId: "signal-core",
		});
		expect(onAutosave).toHaveBeenCalledOnce();
		expect(onAutosave.mock.calls[0][0].location.checkpointId).toBe(
			"signal-core",
		);

		view.unmount();
		session.dispatch({
			type: "checkpoint.reached",
			checkpointId: "signal-entry",
		});
		expect(onAutosave).toHaveBeenCalledOnce();
	});

	it("shows an accessible asset error and recreates Phaser on retry", async () => {
		mocks.instances.length = 0;
		mocks.createPhaserGame.mockClear();
		const session = createSession("asset-error");
		const onExit = vi.fn();
		render(<GameScreen session={session} onExit={onExit} />);
		await waitFor(() => expect(mocks.createPhaserGame).toHaveBeenCalledOnce());
		const onRuntimeError = mocks.createPhaserGame.mock.calls[0][3] as (error: {
			code: "asset";
			assetId: string;
			retryable: boolean;
			message: string;
		}) => void;
		onRuntimeError({
			code: "asset",
			assetId: "relay-camp-field",
			retryable: true,
			message: "A required image failed.",
		});
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"A required image failed.",
		);
		expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
		fireEvent.click(screen.getByRole("button", { name: "Back to launcher" }));
		expect(onExit).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		await waitFor(() =>
			expect(mocks.createPhaserGame).toHaveBeenCalledTimes(2),
		);
	});

	it("shows a retryable error when the Phaser module cannot start", async () => {
		mocks.loadPhaserGameFactory.mockRejectedValueOnce(
			new Error("runtime unavailable"),
		);
		const session = createSession("runtime-start-error");
		render(<GameScreen session={session} onExit={() => undefined} />);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"The game runtime could not be loaded.",
		);
	});

	it("does not offer an endless retry for a non-retryable content error", async () => {
		mocks.createPhaserGame.mockClear();
		const session = createSession("invalid-content-error");
		render(<GameScreen session={session} onExit={() => undefined} />);
		await waitFor(() => expect(mocks.createPhaserGame).toHaveBeenCalledOnce());
		const onRuntimeError = mocks.createPhaserGame.mock.calls[0][3] as (error: {
			code: "content";
			retryable: boolean;
			message: string;
		}) => void;
		onRuntimeError({
			code: "content",
			retryable: false,
			message: "The downloaded world is invalid.",
		});

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"The downloaded world is invalid.",
		);
		expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Back to launcher" }),
		).toHaveFocus();
	});
});
